export const maxDuration = 300;
import { syncLogger } from '@/debug/sync';
import { Database } from '@/lib/database/types';
import { createClient, fetchUserId } from '@/supabase/utils/server';
import { createSuperClient } from '@/supabase/utils/super';
import { SupabaseClient } from '@supabase/supabase-js';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

/**
 * 동기화 레코드 검증 — 최소 필수 필드(id, updated_at)가 있는 객체인지 런타임 검증
 * z.any()와 달리 객체 타입 + 필수 필드 존재를 보장하면서, 하위 함수의 타입 호환성 유지
 */
const syncRecordSchema = z
    .any()
    .refine(
        (val) =>
            typeof val === 'object' &&
            val !== null &&
            typeof val.id === 'string' &&
            typeof val.updated_at === 'number',
        { message: 'Sync record must be an object with id (string) and updated_at' }
    );

/**
 * 동기화 엔티티 스키마 (folder, alarm 공통)
 * created, updated, deleted 배열을 포함하며, 각각 선택적이고 기본값은 빈 배열
 */
const syncEntitySchema = z.object({
    created: z.array(syncRecordSchema).optional().default([]),
    updated: z.array(syncRecordSchema).optional().default([]),
    deleted: z.array(z.string()).optional().default([]),
});

/**
 * 페이지 동기화 엔티티 스키마
 * - type: 페이지 타입 (DRAW 등), 선택적
 */
const pageSyncEntitySchema = syncEntitySchema.extend({
    type: z.string().optional(),
});

/**
 * sync/push API 요청 body 스키마
 * - page: 필수
 * - folder, alarm: 선택적
 */
const syncPushBodySchema = z.object({
    page: pageSyncEntitySchema,
    folder: syncEntitySchema.optional(),
    alarm: syncEntitySchema.optional(),
});

export async function POST(req: Request) {
    const minutesOffset = process.env.NODE_ENV === 'development' ? 0 : 30;

    let supabase;
    let user_id;

    if (process.env.NODE_ENV === 'test' && process.env.VERCEL_ENV !== 'production') {
        supabase = createSuperClient();
        user_id = process.env.TEST_USER_ID;
    } else {
        supabase = await createClient();
        user_id = await fetchUserId();
    }

    if (!user_id) {
        throw new Error('User ID is not set');
    }

    const { searchParams } = new URL(req.url);
    const lastPulledAt = parseInt(searchParams.get('last_pulled_at') || '0');

    // JSON 파싱
    let rawBody;
    try {
        rawBody = await req.json();
    } catch (parseError) {
        syncLogger('sync/push: Invalid JSON body', parseError);
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 유효성 검사
    const parseResult = syncPushBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
        syncLogger('sync/push: Invalid request body', parseResult.error.format());
        return new Response(
            JSON.stringify({
                error: 'Invalid request body',
                details: parseResult.error.format(),
            }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    const { page, folder, alarm } = parseResult.data;

    try {
        // NOTE: 각 엔티티는 개별 Supabase 호출로 처리됩니다.
        // 중간 실패 시 이미 완료된 작업은 롤백되지 않습니다.
        // created 항목은 23505 duplicate 핸들링으로 재시도 시 안전하지만,
        // updated/deleted 항목의 부분 실패는 자동 복구되지 않습니다.

        // 폴더 처리 (folder가 있는 경우에만)
        if (folder) {
            for (const newItem of folder.created) {
                const { data: createData, error: createError } = await createFolder(
                    supabase,
                    newItem,
                    lastPulledAt,
                    user_id
                );

                if (createError && createError.code === '23505') {
                    await updateFolder(supabase, newItem, lastPulledAt, user_id);
                }
            }

            for (const updatedItem of folder.updated) {
                if (await isExistingFolder(supabase, updatedItem.id)) {
                    await updateFolder(supabase, updatedItem, lastPulledAt, user_id);
                } else {
                    await cancelDeleteFolder(supabase, updatedItem.id, user_id);
                    await createFolder(supabase, updatedItem, lastPulledAt, user_id);
                }
            }

            for (const deletedId of folder.deleted) {
                syncLogger('Deleted folder', deletedId);
                const { error: deleteError } = await supabase
                    .from('folder')
                    .delete()
                    .eq('id', deletedId)
                    .eq('user_id', user_id);

                if (deleteError) {
                    syncLogger('폴더 삭제 중 오류 발생 (이미 삭제된 것일 수 있음)', {
                        deletedId,
                        error: deleteError.message,
                    });
                    // 이미 삭제된 폴더인 경우 무시
                } else {
                    syncLogger('폴더 삭제 완료', { deletedId });
                }
            }
        }

        // 페이지 처리
        for (const newItem of page.created) {
            const { data: createData, error: createError } = await createPage(
                supabase,
                newItem,
                lastPulledAt,
                user_id
            );

            if (createError && createError.code === '23505') {
                await updatePage(supabase, newItem, lastPulledAt, user_id);
            }

            if (page.type !== 'DRAW') {
                await updateNoExistJob(supabase, 'EMBEDDING', newItem.id, 0, user_id);
            }
        }

        for (const updatedItem of page.updated) {
            if (await isExistingPage(supabase, updatedItem.id)) {
                await updatePage(supabase, updatedItem, lastPulledAt, user_id);
            } else {
                await cancelDeletePage(supabase, updatedItem.id, user_id);
                await createPage(supabase, updatedItem, lastPulledAt, user_id);
            }
            if (page.type === 'DRAW') {
                continue;
            }
            const { data: existingJobs, error: existingJobsError } = await isExistingJobs(
                supabase,
                updatedItem.id,
                user_id
            );

            if (existingJobs && existingJobs.length > 0) {
                await updateExistingJob(supabase, existingJobs[0].id, minutesOffset, user_id);
            } else {
                await updateNoExistJob(
                    supabase,
                    'EMBEDDING',
                    updatedItem.id,
                    minutesOffset,
                    user_id
                );
            }
        }

        for (const deletedId of page.deleted) {
            syncLogger('Deleted page', deletedId);
            const { error: deleteError } = await supabase
                .from('page')
                .delete()
                .eq('id', deletedId)
                .eq('user_id', user_id);

            if (page.type !== 'DRAW') {
                const { error: deleteJob } = await supabase
                    .from('job_queue')
                    .delete()
                    .eq('user_id', user_id)
                    .eq('payload', deletedId)
                    .eq('job_name', 'EMBEDDING');
            }
            if (deleteError && deleteError.code === '23505') {
                syncLogger('Deleted page is already deleted', deletedId);
                const { error: deleteError } = await supabase
                    .from('page_deleted')
                    .delete()
                    .eq('user_id', user_id)
                    .eq('id', deletedId);
                if (!deleteError) {
                    const { error: deleteError } = await supabase
                        .from('page')
                        .delete()
                        .eq('user_id', user_id)
                        .eq('id', deletedId);
                    syncLogger('Deleted page is deleted', deletedId);
                }
            }
        }
        // 알람 처리 (alarm이 있는 경우에만)
        if (alarm) {
            for (const newItem of alarm.created) {
                const { data: createData, error: createError } = await createAlarm(
                    supabase,
                    newItem,
                    lastPulledAt,
                    user_id
                );

                if (createError && createError.code === '23505') {
                    await updateAlarm(supabase, newItem, lastPulledAt, user_id);
                }
            }

            for (const updatedItem of alarm.updated) {
                if (await isExistingAlarm(supabase, updatedItem.id)) {
                    await updateAlarm(supabase, updatedItem, lastPulledAt, user_id);
                } else {
                    await createAlarm(supabase, updatedItem, lastPulledAt, user_id);
                }
            }

            for (const deletedId of alarm.deleted) {
                syncLogger('Deleted alarm', deletedId);

                // 알람 삭제 (트리거가 자동으로 alarm_deleted에 기록)
                const { error: deleteError } = await supabase
                    .from('alarm')
                    .delete()
                    .eq('id', deletedId)
                    .eq('user_id', user_id);

                if (deleteError) {
                    syncLogger('알람 삭제 중 오류 발생 (이미 삭제된 것일 수 있음)', {
                        deletedId,
                        error: deleteError.message,
                    });
                    // 이미 삭제된 알람인 경우 무시
                } else {
                    syncLogger('알람 삭제 완료', { deletedId });
                }
            }
        }

        // 개발환경에서 임베딩을 즉시 실행 (사용자 인증 기반)
        // 참고: embedding-scheduler는 사용자 트리거 방식으로 변경됨 (Cron 의존성 제거)
        // 개발환경에서는 쿠키를 전달하여 인증을 처리합니다.
        if (process.env.NODE_ENV === 'development') {
            syncLogger(
                '개발환경에서는 즉시 임베딩을 실행합니다. 수정의 경우 지정된 시간 이후에 실행됩니다.'
            );
            // 참고: 클라이언트 측에서 직접 호출하거나, 여기서는 job_queue에 작업만 등록됨
            // 실제 임베딩 처리는 클라이언트에서 /api/ai/embedding-scheduler?user_id=xxx 호출 시 수행
        }

        const body = JSON.stringify({ success: true });
        return new Response(body, {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        syncLogger('Sync push error:', error);
        syncLogger('sync_push_error', {
            user_id: user_id,
            lastPulledAt: lastPulledAt,
            pageCount: {
                created: page?.created?.length || 0,
                updated: page?.updated?.length || 0,
                deleted: page?.deleted?.length || 0,
            },
            folderCount: folder
                ? {
                      created: folder.created?.length || 0,
                      updated: folder.updated?.length || 0,
                      deleted: folder.deleted?.length || 0,
                  }
                : null,
            alarmCount: alarm
                ? {
                      created: alarm.created?.length || 0,
                      updated: alarm.updated?.length || 0,
                      deleted: alarm.deleted?.length || 0,
                  }
                : null,
            requestUrl: req.url,
            isDevelopment: process.env.NODE_ENV === 'development',
        });

        syncLogger('Sync push error:', error);
        syncLogger('동기화 푸시 중 오류 발생:', error);

        const body = JSON.stringify({ error: error.message });
        return new Response(body, {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        });
    }
}

async function isExistingJobs(
    supabase: SupabaseClient<any, 'public', any>,
    updatedItemId: string,
    user_id: string
): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase
        .from('job_queue')
        .select('*')
        .eq('user_id', user_id)
        .eq('job_name', 'EMBEDDING')
        .eq('payload', updatedItemId);

    if (error) {
        syncLogger('job_queue_error', {
            user_id: user_id,
            updatedItemId: updatedItemId,
            operation: 'select_existing_jobs',
        });
        syncLogger('Sync push error:', error);
        throw new Error('큐를 생성하는 과정에서 오류가 발생했습니다:' + error);
    }

    return { data, error };
}

async function updateExistingJob(
    supabase: SupabaseClient<any, 'public', any>,
    jobId: string,
    minutesOffset: number,
    user_id: string
) {
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + minutesOffset); // 현재 시간에 minutesOffset을 더함

    const { data, error } = await supabase
        .from('job_queue')
        .update({
            scheduled_time: scheduledTime.toISOString(), // 계산된 시간으로 업데이트
            status: 'PENDING',
        })
        .eq('user_id', user_id)
        .eq('id', jobId);

    if (error) {
        syncLogger('job_update_error', {
            jobId: jobId,
            minutesOffset: minutesOffset,
            operation: 'update_existing_job',
        });
        syncLogger('Sync push error:', error);
        syncLogger('Error updating job:', error);
        throw error;
    }

    return data;
}

async function updateNoExistJob(
    supabase: SupabaseClient<any, 'public', any>,
    jobName: string,
    payload: string,
    minutesOffset: number,
    user_id: string
) {
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + minutesOffset); // 현재 시간에 minutesOffset을 더함

    const { data, error } = await supabase.from('job_queue').insert({
        job_name: jobName,
        payload: payload,
        scheduled_time: scheduledTime.toISOString(), // 계산된 시간으로 업데이트
        status: 'PENDING',
        user_id: user_id,
    });

    if (error) {
        syncLogger('job_insert_error', {
            jobName: jobName,
            payload: payload,
            minutesOffset: minutesOffset,
            operation: 'insert_new_job',
        });
        syncLogger('Sync push error:', error);
        syncLogger('Error inserting new job:', error);
        throw error;
    }

    return data;
}

async function isExistingPage(
    supabase: SupabaseClient<Database, 'public'>,
    id: string
): Promise<boolean> {
    const { data: existingPage } = await supabase.from('page').select('id').eq('id', id).single();
    return existingPage !== null;
}

async function createPage(
    supabase: SupabaseClient<Database, 'public'>,
    newItem: {
        id: string;
        title: string;
        body: string;
        is_public: boolean;
        img_url: string | null;
        length: number;
        type: Database['public']['Enums']['page_type'];
        folder_id: string | null;
        created_at: number;
        updated_at: number;
        last_viewed_at: number;
    },
    lastPulledAt: number,
    user_id: string
) {
    const createdAt = new Date(newItem.created_at).toISOString();
    const updatedAt = new Date(Math.min(newItem.updated_at, lastPulledAt - 1)).toISOString();
    const lastViewedAt = new Date(newItem.last_viewed_at).toISOString();

    const result = await supabase.from('page').insert({
        id: newItem.id,
        user_id: user_id,
        title: newItem.title,
        body: newItem.body,
        is_public: newItem.is_public,
        img_url: newItem.img_url,
        length: newItem.length,
        type: newItem.type,
        folder_id: newItem.folder_id,
        created_at: createdAt,
        updated_at: updatedAt,
        last_viewed_at: lastViewedAt,
    });

    if (result.error) {
        syncLogger('page_create_error', {
            page_id: newItem.id,
            user_id: user_id,
            operation: 'create_page',
            error_code: result.error.code,
        });
        // 23505 에러는 상위에서 처리하므로 throw하지 않음
        if (result.error.code !== '23505') {
            syncLogger('Sync push error:', result.error);
            throw result.error;
        }
    }

    return result;
}

async function updatePage(
    supabase: SupabaseClient<Database, 'public'>,
    updatedItem: {
        id: string;
        title: string;
        body: string;
        is_public: boolean;
        img_url: string | null;
        length: number;
        folder_id: string | null;
        created_at: number;
        updated_at: number;
        last_viewed_at: number;
    },
    lastPulledAt: number,
    user_id: string
) {
    const lastViewedAt = new Date(updatedItem.last_viewed_at).toISOString();
    const updatedAt = new Date(Math.min(updatedItem.updated_at, lastPulledAt - 1)).toISOString();
    const createdAt = new Date(updatedItem.created_at).toISOString();
    const { data, error: updateError } = await supabase
        .from('page')
        .update({
            title: updatedItem.title,
            body: updatedItem.body,
            is_public: updatedItem.is_public,
            img_url: updatedItem.img_url,
            length: updatedItem.length,
            folder_id: updatedItem.folder_id,
            last_viewed_at: lastViewedAt,
            updated_at: updatedAt,
            created_at: createdAt,
        })
        .eq('user_id', user_id)
        .match({ id: updatedItem.id });

    if (updateError) {
        syncLogger('page_update_error', {
            page_id: updatedItem.id,
            user_id: user_id,
            operation: 'update_page',
        });
        syncLogger('Update error:', updateError);
        throw updateError;
    }

    // 모든 페이지 업데이트에 대해 캐시 갱신
    try {
        syncLogger(`캐시 갱신 시작: ${updatedItem.id}`);
        await revalidateTag(`share-page-${updatedItem.id}`, 'max');
        syncLogger(`캐시 갱신 완료: ${updatedItem.id}`);
    } catch (error) {
        syncLogger(`캐시 갱신 실패: ${error}`);
        syncLogger('캐시 갱신 실패:', error);
    }

    return { data, updateError };
}

async function cancelDeletePage(
    supabase: SupabaseClient<Database, 'public'>,
    id: string,
    user_id: string
) {
    return await supabase.from('page_deleted').delete().eq('user_id', user_id).eq('id', id);
}

async function createFolder(
    supabase: SupabaseClient<Database, 'public'>,
    newItem: {
        id: string;
        name: string;
        description: string | null;
        thumbnail_url: string | null;
        page_count: number;
        created_at: number;
        updated_at: number;
        last_page_added_at: number | null;
    },
    lastPulledAt: number,
    user_id: string
) {
    const createdAt = new Date(newItem.created_at).toISOString();
    const updatedAt = new Date(Math.min(newItem.updated_at, lastPulledAt - 1)).toISOString();
    const lastPageAddedAt = newItem.last_page_added_at
        ? new Date(newItem.last_page_added_at).toISOString()
        : null;

    const result = await supabase.from('folder').insert({
        id: newItem.id,
        user_id,
        name: newItem.name,
        description: newItem.description,
        thumbnail_url: newItem.thumbnail_url,
        page_count: newItem.page_count,
        created_at: createdAt,
        updated_at: updatedAt,
        last_page_added_at: lastPageAddedAt,
    });

    if (result.error) {
        syncLogger('folder_create_error', {
            folder_id: newItem.id,
            user_id: user_id,
            operation: 'create_folder',
            error_code: result.error.code,
        });
        // 23505 에러는 상위에서 처리하므로 throw하지 않음
        if (result.error.code !== '23505') {
            syncLogger('Sync push error:', result.error);
            throw result.error;
        }
    }

    return result;
}

async function updateFolder(
    supabase: SupabaseClient<Database, 'public'>,
    updatedItem: {
        id: string;
        name: string;
        description: string | null;
        thumbnail_url: string | null;
        page_count: number;
        updated_at: number;
        last_page_added_at: number | null;
    },
    lastPulledAt: number,
    user_id: string
) {
    const updatedAt = new Date(Math.min(updatedItem.updated_at, lastPulledAt - 1)).toISOString();
    const lastPageAddedAt = updatedItem.last_page_added_at
        ? new Date(updatedItem.last_page_added_at).toISOString()
        : null;

    const { data, error: updateError } = await supabase
        .from('folder')
        .update({
            name: updatedItem.name,
            description: updatedItem.description,
            thumbnail_url: updatedItem.thumbnail_url,
            page_count: updatedItem.page_count,
            updated_at: updatedAt,
            last_page_added_at: lastPageAddedAt,
        })
        .eq('user_id', user_id)
        .match({ id: updatedItem.id });

    if (updateError) {
        syncLogger('folder_update_error', {
            folder_id: updatedItem.id,
            user_id: user_id,
            operation: 'update_folder',
        });
        syncLogger('Update error:', updateError);
        throw updateError;
    }

    return { data, updateError };
}

async function cancelDeleteFolder(
    supabase: SupabaseClient<Database, 'public'>,
    id: string,
    user_id: string
) {
    return await supabase.from('folder_deleted').delete().eq('user_id', user_id).eq('id', id);
}

async function isExistingFolder(
    supabase: SupabaseClient<Database, 'public'>,
    id: string
): Promise<boolean> {
    const { data: existingFolder } = await supabase
        .from('folder')
        .select('id')
        .eq('id', id)
        .single();
    return existingFolder !== null;
}

// 알람 관련 유틸리티 함수들
async function createAlarm(
    supabase: SupabaseClient<Database, 'public'>,
    newItem: {
        id: string;
        next_alarm_time: number | null;
        page_id: string;
        last_notification_id: string | null;
        sent_count: number | null;
        created_at: number;
        updated_at: number;
    },
    lastPulledAt: number,
    user_id: string
) {
    const createdAt = new Date(newItem.created_at).toISOString();
    const updatedAt = new Date(Math.min(newItem.updated_at, lastPulledAt - 1)).toISOString();
    const nextAlarmTime = newItem.next_alarm_time
        ? new Date(newItem.next_alarm_time).toISOString()
        : null;

    const result = await supabase.from('alarm').insert({
        id: newItem.id,
        user_id: user_id,
        next_alarm_time: nextAlarmTime,
        page_id: newItem.page_id,
        last_notification_id: newItem.last_notification_id,
        sent_count: newItem.sent_count || 1,
        created_at: createdAt,
        updated_at: updatedAt,
    });

    if (result.error) {
        syncLogger('알람 생성 오류', {
            alarm_id: newItem.id,
            user_id: user_id,
            error: result.error.message,
            error_code: result.error.code,
        });
        syncLogger('alarm_create_error', {
            alarm_id: newItem.id,
            user_id: user_id,
            operation: 'create_alarm',
            error_code: result.error.code,
        });
        // 23505 에러는 상위에서 처리하므로 throw하지 않음
        if (result.error.code !== '23505') {
            syncLogger('Sync push error:', result.error);
            throw result.error;
        }
    }

    syncLogger('알람 생성 완료', { alarm_id: newItem.id });
    return result;
}

async function updateAlarm(
    supabase: SupabaseClient<Database, 'public'>,
    updatedItem: {
        id: string;
        next_alarm_time: number | null;
        page_id: string;
        last_notification_id: string | null;
        sent_count: number | null;
        updated_at: number;
    },
    lastPulledAt: number,
    user_id: string
) {
    const updatedAt = new Date(Math.min(updatedItem.updated_at, lastPulledAt - 1)).toISOString();
    const nextAlarmTime = updatedItem.next_alarm_time
        ? new Date(updatedItem.next_alarm_time).toISOString()
        : null;

    const { data, error: updateError } = await supabase
        .from('alarm')
        .update({
            next_alarm_time: nextAlarmTime,
            page_id: updatedItem.page_id,
            last_notification_id: updatedItem.last_notification_id,
            sent_count: updatedItem.sent_count || 1,
            updated_at: updatedAt,
        })
        .eq('id', updatedItem.id)
        .eq('user_id', user_id);

    if (updateError) {
        syncLogger('알람 업데이트 오류', {
            alarm_id: updatedItem.id,
            user_id: user_id,
            error: updateError.message,
        });
        syncLogger('alarm_update_error', {
            alarm_id: updatedItem.id,
            user_id: user_id,
            operation: 'update_alarm',
        });
        syncLogger('Update error:', updateError);
        throw updateError;
    }

    syncLogger('알람 업데이트 완료', { alarm_id: updatedItem.id });
    return { data, updateError };
}

async function isExistingAlarm(
    supabase: SupabaseClient<Database, 'public'>,
    id: string
): Promise<boolean> {
    const { data: existingAlarm } = await supabase.from('alarm').select('id').eq('id', id).single();
    return existingAlarm !== null;
}

/*
Implementing push endpoint
The push endpoint MUST apply local changes (passed as a changes object) to the database. Specifically:
create new records as specified by the changes object
update existing records as specified by the changes object
delete records by the specified IDs
=> 완료

If the changes object contains a new record with an ID that already exists, you MUST update it, and MUST NOT return an error code.
(This happens if previous push succeeded on the backend, but not on frontend)
=> 완료

If the changes object contains an update to a record that does not exist, then:
If you can determine that this record no longer exists because it was deleted, you SHOULD return an error code (to force frontend to pull the information about this deleted ID)
Otherwise, you MUST create it, and MUST NOT return an error code. (This scenario should not happen, but in case of frontend or backend bugs, it would keep sync from ever succeeding.)
=> 완료 : 서버 쪽 구현 - 수정 시 페이지가 없다면 새로 생성함, 클라이언트 쪽 구현 - 삭제된 페이지를 수정하려고 시도하면 예외가 발생하고, 원한다면 새로운 게시글을 작성할 수 있도록 안내함. 

If the changes object contains a record to delete that doesn't exist, you MUST ignore it and MUST NOT return an error code
(This may happen if previous push succeeded on the backend, but not on frontend, or if another user deleted this record in between user's pull and push calls)
=> 완료 

If application of all local changes succeeds, the endpoint MUST return a success status code.
=> 완료

You MUST ignore _status and _changed fields contained in records in changes object
=> 완료

엔드포인트에 전달된 데이터를 유효성 검사해야 합니다. 특히, 컬렉션 및 열 이름과 ID 형식과 같은 응용 프로그램별 불변식과 같은 것들이 화이트리스트에 있어야 합니다.
=> 완료

엔드포인트에 전달된 레코드 필드를 살균해야 합니다. 데이터의 내용에 약간의 문제가 있을 경우(형태가 아닌) 오류 코드를 보내지 말아야 합니다. 대신 오류를 "수정"하는 것을 선호합니다(올바른 형식으로 살균).
=> 완료

삭제된 레코드의 모든 하위 항목을 삭제해야 합니다.
=> 완료

프론트엔드가 삭제된 레코드의 모든 하위 항목을 삭제하도록 푸시 엔드포인트에 요청해야 하지만, 버그가 있으면 영구적인 고아가 생길 수 있습니다.
=> 완료

동기화는 신뢰할 수 있어야 하며, 일시적으로 실패하거나 심각한 프로그래밍 오류를 제외하고는 실패해서는 안됩니다. 그렇지 않으면 사용자는 영구적으로 동기화할 수 없는 앱을 가지게 되고, 로그아웃/삭제하고 동기화되지 않은 데이터를 잃어야 할 수도 있습니다. 5버전 전의 버그로 인해 영구적으로 실패하는 동기화가 발생하지 않도록 해야 합니다.

만약 changes 객체가 lastPulledAt 이후에 서버에서 수정된 레코드를 포함하고 있다면, 푸시를 중단하고 오류 코드를 반환해야 합니다. 이 시나리오는 충돌이 있음을 의미하며, 레코드가 사용자의 풀과 푸시 호출 사이에 원격으로 업데이트되었습니다. 오류를 반환하면 프론트엔드가 충돌을 해결하기 위해 다시 풀 엔드포인트를 호출하도록 강제합니다.
=> 재검토 필요. 이 정책은 서버쪽의 내용을 우선시 합니다. 다만, 우리 서비스는 개인적인 메모이기 때문에 충돌이 발생할 가능성이 매우 낮고, 발생한다고 해도, 지금 사용자 앞에 있는 디바이스가 가장 최신 데이터로 다뤄지기를 사용자는 원할 것입니다. 그래서 이와 관련해서는 특별한 조치를 하지 않겠습니다. 

The push endpoint MUST be fully transactional. If there is an error, all local changes MUST be reverted on the server, and en error code MUST be returned.

현재 구현: 개별 Supabase 호출로 처리됨 (비트랜잭션).
- 부분 실패 시 23505 duplicate 에러 핸들링으로 재시도 시 자동 복구됨.
- 완전한 트랜잭션화를 위해서는 PostgreSQL RPC 함수로 래핑이 필요함.
- 개인 메모 서비스 특성상 동시 충돌 가능성이 매우 낮아 현재 방식으로도 실질적 문제 발생 확률이 낮음.
TODO: 필요 시 supabase.rpc()로 트랜잭션 래핑 구현.

*/
