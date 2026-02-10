import { deleteFiles } from '@/functions/media/uploadcare';
import { Database } from '@/lib/database/types';
import errorResponse, { successResponse } from '@/functions/api/response';
import { createClient } from '@/supabase/utils/server';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getServerI18n } from '@/lib/lingui';
import { msg } from '@lingui/core/macro';
import { parseLocaleFromAcceptLanguage } from '@/functions/constants';
import { createSuperClient } from '@/supabase/utils/super';
import { withdrawLogger } from '@/debug/withdraw';

export async function POST(req: NextRequest) {
    withdrawLogger('=== 탈퇴 프로세스 시작 ===');
    const locale = parseLocaleFromAcceptLanguage(req.headers.get('accept-language'));
    const i18n = await getServerI18n(locale);
    withdrawLogger('언어 설정:', locale);

    // 일반 클라이언트로 로그인 사용자 확인 (테스트 환경에서는 SSR 쿠키 접근을 우회)
    let userId: string | undefined;
    let userEmail: string | undefined;
    if (process.env.NODE_ENV === 'test') {
        userId = req.headers.get('x-test-user-id') || undefined;
    } else {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id;
        userEmail = user?.email ?? undefined;
    }

    withdrawLogger('사용자 정보 확인:', userId ? { id: userId, email: userEmail } : 'null');

    if (process.env.NODE_ENV !== 'test') {
        if (!userId) {
            withdrawLogger('사용자 인증 실패 - 탈퇴 프로세스 중단');
            return errorResponse(
                {
                    status: 401,
                    errorCode: 'NO_USER_INFO',
                    data: {},
                    meta: {},
                    message: i18n._(msg`로그인이 필요합니다. 사용자 정보를 찾지 못했습니다.`),
                },
                new Error('Authentication failed: user not found')
            );
        }
    }

    try {
        withdrawLogger('=== 데이터 정리 단계 시작 ===');
        // service role 권한으로 클라이언트 생성
        const superClient = createSuperClient();

        // 사용자 삭제 전 연관 데이터 먼저 정리
        // 트리거 문제를 피하기 위해 folder를 먼저 삭제 (나머지는 CASCADE로 자동 삭제됨)

        // 페이지를 삭제하면 폴더의 count 컬럼이 갱신된다. (update_folder_page_count) 그런데 user가 삭제되면서 folder가 삭제 되었는데, page도 삭제가 되면 folder.count를 업데이트하려고 해도 folder가 존재하지 않기 때문에 오류가 발생하고 user 삭제가 불발되는 문제가 있다. 이를 우회하기 위해서 folder를 먼저 삭제한다.
        withdrawLogger('folder 테이블 데이터 삭제 시작 (트리거 문제 회피용)');
        const { error: folderError } = await superClient
            .from('folder')
            .delete()
            .eq('user_id', userId as string);
        if (folderError) {
            withdrawLogger('folder 테이블 삭제 중 에러:', folderError);
        } else {
            withdrawLogger('folder 테이블 데이터 삭제 완료');
        }

        withdrawLogger('job_queue 테이블 데이터 삭제 시작');
        await superClient
            .from('job_queue')
            .delete()
            .eq('user_id', userId as string);
        withdrawLogger('job_queue 테이블 데이터 삭제 완료');

        withdrawLogger('folder_deleted 테이블 데이터 삭제 시작');
        const { error: folderDeletedError } = await superClient
            .from('folder_deleted')
            .delete()
            .eq('user_id', userId as string);
        if (folderDeletedError) {
            withdrawLogger('folder_deleted 테이블 삭제 중 에러:', folderDeletedError);
        } else {
            withdrawLogger('folder_deleted 테이블 데이터 삭제 완료');
        }

        withdrawLogger('beta_tester 테이블 데이터 삭제 시작');
        const { error: betaTesterError } = await superClient
            .from('beta_tester')
            .delete()
            .eq('user_id', userId as string);
        if (betaTesterError) {
            withdrawLogger('beta_tester 테이블 삭제 중 에러:', betaTesterError);
        } else {
            withdrawLogger('beta_tester 테이블 데이터 삭제 완료');
        }

        // 탈퇴시 uploadcare 파일 삭제 처리
        withdrawLogger('=== Uploadcare 파일 처리 단계 시작 ===');
        // 1. 사용자의 모든 페이지를 가져와서 uploadcare 파일 uuid 추출
        // img_url이 null이 아닌 페이지만 조회하여 성능 최적화
        const { data: pages } = await superClient
            .from('page')
            .select('body')
            .eq('user_id', userId as string)
            .not('img_url', 'is', null);

        withdrawLogger('사용자 페이지 수:', pages?.length || 0);

        if (pages) {
            // page body에서 이미지 링크를 모두 추출한 후 파일 uuid 를 찾아 fileUUIDs에 담는다. (중복 방지)
            const fileUUIDSet: Set<string> = new Set();
            // Uploadcare UUID 패턴: 8-4-4-4-12 형식의 UUID 또는 22자 ULID 형식
            const uuidRegex =
                /https:\/\/ucarecdn\.com\/([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}|[a-zA-Z0-9]{22})/g;

            for (const page of pages) {
                if (!page?.body) continue;
                // body에서 모든 uploadcare 파일 링크의 uuid 추출
                for (const match of page.body.matchAll(uuidRegex)) {
                    if (match[1]) {
                        fileUUIDSet.add(match[1]);
                    }
                }
            }
            const fileUUIDs: string[] = Array.from(fileUUIDSet);

            withdrawLogger('발견된 Uploadcare 파일 UUID 수:', fileUUIDs.length);
            if (fileUUIDs.length > 0) {
                withdrawLogger('발견된 파일 UUID들:', fileUUIDs);
            }

            if (fileUUIDs.length > 0) {
                try {
                    withdrawLogger('Uploadcare 파일 삭제 시작');
                    await deleteFiles(fileUUIDs);
                    withdrawLogger('Uploadcare 파일 삭제 완료');
                } catch (deleteError) {
                    withdrawLogger('Uploadcare 파일 삭제 실패:', deleteError);
                    console.error('Withdraw error:', deleteError);
                    // 파일 삭제 실패가 전체 탈퇴 프로세스를 막지 않도록 에러를 다시 throw하지 않음
                }
            }
        }

        // service role 클라이언트로 사용자 삭제 실행
        withdrawLogger('=== 사용자 삭제 단계 시작 ===');

        const { error } = await superClient.auth.admin.deleteUser(userId as string);
        if (error) {
            withdrawLogger('사용자 삭제 실패:', error);
            withdrawLogger('에러 타입:', typeof error);
            withdrawLogger('에러 구조:', JSON.stringify(error, null, 2));

            // PostgreSQL 에러 상세 정보 추출 시도
            if (error.message) {
                withdrawLogger('에러 메시지:', error.message);
                if (error.message.includes('violates foreign key constraint')) {
                    withdrawLogger('🔍 외래키 제약조건 위반 감지됨');
                }
            }

            throw error;
        }
        withdrawLogger('사용자 삭제 완료');

        withdrawLogger('page_deleted 테이블 데이터 삭제 시작');
        const { error: pageDeletedError } = await superClient
            .from('page_deleted')
            .delete()
            .eq('user_id', userId as string);
        if (pageDeletedError) {
            withdrawLogger('page_deleted 테이블 삭제 중 에러:', pageDeletedError);
        } else {
            withdrawLogger('page_deleted 테이블 데이터 삭제 완료');
        }

        withdrawLogger('alarm_deleted 테이블 데이터 삭제 시작');
        const { error: alarmDeletedError } = await superClient
            .from('alarm_deleted')
            .delete()
            .eq('user_id', userId as string);
        if (alarmDeletedError) {
            withdrawLogger('alarm_deleted 테이블 삭제 중 에러:', alarmDeletedError);
        } else {
            withdrawLogger('alarm_deleted 테이블 데이터 삭제 완료');
        }

        withdrawLogger('folder 테이블 데이터 삭제 시작 (트리거 회피 처리 후 생성된 데이터 삭제용)');
        const { error: folderError2 } = await superClient
            .from('folder')
            .delete()
            .eq('user_id', userId as string);
        if (folderError2) {
            withdrawLogger('folder 테이블 삭제 중 에러:', folderError2);
        } else {
            withdrawLogger('folder 테이블 데이터 삭제 완료');
        }

        /*
        -- 점검할 이메일만 바꿔서 실행하세요

        WITH params AS (

          SELECT lower('egoing4@gmail.com') AS email

        ),


        -- 1) auth.users 기본 정보

        user_row AS (

          SELECT

            u.id,

            u.email,

            u.created_at,

            u.last_sign_in_at,

            u.confirmed_at,

            u.deleted_at,

            u.banned_until,

            u.raw_user_meta_data

          FROM auth.users u

          JOIN params p ON lower(u.email) = p.email

        ),


        -- 2) auth.identities 잔존 여부

        identities AS (

          SELECT

            i.user_id,

            i.provider,

            i.email,

            i.created_at,

            i.last_sign_in_at

          FROM auth.identities i

          WHERE i.user_id IN (SELECT id FROM user_row)

        ),


        -- 3) 앱 연관 데이터 점검 (실테이블로 교체 완료)

        -- public.user_info: 1:1 프로필

        user_info AS (

          SELECT ui.*

          FROM public.user_info ui

          WHERE ui.user_id IN (SELECT id FROM user_row)

        ),

        -- public.documents: 사용자 생성 문서 수

        user_documents AS (

          SELECT COUNT(*)::bigint AS remaining_documents

          FROM public.documents d

          WHERE d.user_id IN (SELECT id FROM user_row)

        ),

        -- public.page: 사용자 페이지 수

        user_pages AS (

          SELECT COUNT(*)::bigint AS remaining_pages

          FROM public.page p

          WHERE p.user_id IN (SELECT id FROM user_row)

        ),



        -- 4) Storage: 메타데이터에 user_id가 기록되어 있다면 해당 파일 조회

        storage_by_metadata AS (

          SELECT bucket_id, name, id, created_at, updated_at

          FROM storage.objects

          WHERE (metadata->>'user_id') IN (SELECT id::text FROM user_row)

        ),


        -- 5) 선택: 경로 규칙 점검이 필요하면 버킷/경로 규칙에 맞게 수정하세요.

        -- 예: 'user-uploads/<user_id>/...' 구조라면 아래 주석 해제 후 bucket_id를 실제로 변경

        -- storage_by_path AS (

        --   SELECT bucket_id, name, id

        --   FROM storage.objects

        --   WHERE bucket_id = 'user-uploads'

        --     AND split_part(name, '/', 1) IN (SELECT id::text FROM user_row)

        -- ),


        -- 6) 선택: Auth 감사 로그(auth.audit_log_entries)에서 해당 이메일 흔적 확인

        auth_audit AS (

          SELECT ale.*

          FROM auth.audit_log_entries ale

          WHERE (ale.payload::jsonb ->> 'user_email') = (SELECT email FROM params)

          ORDER BY ale.created_at DESC

          LIMIT 10

        )


        -- 최종 출력 (라벨별로 묶어서 확인)

        SELECT 'auth.users' AS section, to_jsonb(u.*) AS payload FROM user_row u

        UNION ALL

        SELECT 'auth.identities' AS section, to_jsonb(i.*) AS payload FROM identities i

        UNION ALL

        SELECT 'public.user_info' AS section, to_jsonb(ui.*) AS payload FROM user_info ui

        UNION ALL

        SELECT 'public.documents_count' AS section, to_jsonb(ud.*) AS payload FROM user_documents ud

        UNION ALL

        SELECT 'public.page_count' AS section, to_jsonb(up.*) AS payload FROM user_pages up

        UNION ALL


        SELECT 'storage.by_metadata' AS section, to_jsonb(sbm.*) AS payload FROM storage_by_metadata sbm

        -- UNION ALL

        -- SELECT 'storage.by_path' AS section, to_jsonb(sbp.*) AS payload FROM storage_by_path sbp

        UNION ALL

        SELECT 'auth.audit_log_entries' AS section, to_jsonb(al.*) AS payload FROM auth_audit al

        ;

        -- 탈퇴 로직이 변경될 때 반드시 이 쿼리도 함께 업데이트하세요.

        */

        // 삭제 전 마지막 확인 - 어떤 테이블에 아직 데이터가 남아있는지 체크
        withdrawLogger('=== 삭제 전 최종 데이터 확인 ===');
        try {
            const tableChecks = [
                {
                    name: 'alarm',
                    query: superClient
                        .from('alarm')
                        .select('count', { count: 'exact' })
                        .eq('user_id', userId as string),
                },
                {
                    name: 'custom_prompts',
                    query: superClient
                        .from('custom_prompts')
                        .select('count', { count: 'exact' })
                        .eq('user_id', userId as string),
                },
                {
                    name: 'documents',
                    query: superClient
                        .from('documents')
                        .select('count', { count: 'exact' })
                        .eq('user_id', userId as string),
                },
                {
                    name: 'page',
                    query: superClient
                        .from('page')
                        .select('count', { count: 'exact' })
                        .eq('user_id', userId as string),
                },
                {
                    name: 'superuser',
                    query: superClient
                        .from('superuser')
                        .select('count', { count: 'exact' })
                        .eq('user_id', userId as string),
                },
                {
                    name: 'user_info',
                    query: superClient
                        .from('user_info')
                        .select('count', { count: 'exact' })
                        .eq('user_id', userId as string),
                },
            ];

            for (const check of tableChecks) {
                const { count, error: checkError } = await check.query;
                if (checkError) {
                    withdrawLogger(`${check.name} 테이블 확인 에러:`, checkError);
                } else if (count && count > 0) {
                    withdrawLogger(`⚠️ ${check.name} 테이블에 아직 ${count}개 데이터 남아있음`);
                } else {
                    withdrawLogger(`✅ ${check.name} 테이블 데이터 없음`);
                }
            }
        } catch (checkError) {
            withdrawLogger('데이터 확인 중 에러:', checkError);
            console.error('Withdraw error:', checkError);
        }
    } catch (e) {
        withdrawLogger('=== 탈퇴 프로세스 에러 발생 ===');
        withdrawLogger('에러 상세:', e);
        console.error('Withdraw error:', e); // 에러 로깅
        return errorResponse(
            {
                status: 500,
                errorCode: 'WITHDRAW_FAILED',
                data: {},
                meta: {},
                message: i18n._(msg`탈퇴에 실패했습니다. 관리자에게 문의 해주세요.`),
            },
            e
        );
    }

    withdrawLogger('=== 탈퇴 프로세스 성공 완료 ===');
    return successResponse({
        status: 200,
        message: i18n._(msg`성공적으로 처리했습니다. 그 동안 이용해주셔서 감사합니다.`),
    });
}
