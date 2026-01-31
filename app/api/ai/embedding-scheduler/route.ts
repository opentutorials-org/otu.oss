export const maxDuration = 300;
import { createEmbeddingUsingCohere } from '@/functions/ai';
import { reportErrorToSentry } from '@/functions/error';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
const { convert } = require('html-to-text');
import pMap from 'p-map';
import { embeddingLogger } from '@/debug/embedding';
import { addBreadcrumb, captureCheckIn, captureMessage, flush } from '@sentry/nextjs';
import { createClient } from '@/supabase/utils/server';
import { createSuperClient } from '@/supabase/utils/super';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database/types';
import {
    RAG_SEARCH_MIN_LENGTH_THRESHOLD,
    parseLocaleFromAcceptLanguage,
} from '@/functions/constants';
import { getTranslations } from 'next-intl/server';
import { cronLogger } from '@/debug/cron';
import { canUseEmbeddings, getEmbeddingsDisabledReason } from '@/functions/ai/config';

export async function GET(request: Request) {
    cronLogger('embedding scheduler 시작');

    // 임베딩 기능 활성화 여부 확인
    if (!canUseEmbeddings()) {
        const reason = getEmbeddingsDisabledReason();
        cronLogger('Embedding scheduler disabled', { reason });
        return new Response(
            JSON.stringify({
                message: 'Embedding feature is disabled',
                reason,
                processed: 0,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // URL에서 쿼리 파라미터 추출
    const url = new URL(request.url);
    const userIdParam = url.searchParams.get('user_id');

    let checkInId;
    const monitorSlug = 'embedding-scheduler';
    embeddingLogger('process.env.NODE_ENV', process.env.NODE_ENV);
    if (!userIdParam && process.env.NODE_ENV === 'production') {
        checkInId = captureCheckIn(
            {
                monitorSlug: monitorSlug,
                status: 'in_progress',
            },
            {
                schedule: {
                    type: 'crontab',
                    value: '* * * * *',
                },
                checkinMargin: 5,
                maxRuntime: 50,
            }
        );
        cronLogger('cron check', {
            status: 'in_progress',
            id: checkInId,
        });
    }

    const locale = parseLocaleFromAcceptLanguage(request.headers.get('accept-language'));
    const t = await getTranslations({ locale });

    embeddingLogger('start');
    const startTime = performance.now();

    let supabase: SupabaseClient<Database>;

    if (userIdParam) {
        supabase = await createClient();
        const { data, error } = await supabase.auth.getUser();
        addBreadcrumb({
            category: 'embedding',
            data: {
                data,
                error,
            },
        });
        if (!data.user) {
            captureMessage('인증에 실패했습니다. 이 문제는 무시해도 됩니다.');
            return new Response(t('api.embedding-scheduler.unauthorized'), {
                status: 401,
            });
        }
        if (userIdParam !== data.user.id) {
            captureMessage(
                '인증에 실패했습니다. embedding의 user_id와 현재 로그인한 user_id가 일치하지 않습니다. 이 문제가 급격히 증가했다면 조사하십시오.'
            );
            return new Response(t('api.embedding-scheduler.unauthorized'), {
                status: 401,
            });
        }
    } else {
        if (process.env.CRON_SECRET === undefined) {
            embeddingLogger(
                'CRON_SECRET 가 설정되지 않았습니다. .env.template를 참조해서 .env 파일에 추가해주세요'
            );
            throw new Error(t('api.embedding-scheduler.cron-secret-missing'));
        }
        const authHeader = request.headers.get('authorization');
        if (
            process.env.NODE_ENV !== 'development' &&
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            embeddingLogger(
                'Unauthorized',
                authHeader !== `Bearer ${process.env.CRON_SECRET}`,
                authHeader,
                `Bearer ${process.env.CRON_SECRET}`
            );
            if (checkInId) {
                const id = captureCheckIn({
                    checkInId,
                    monitorSlug,
                    status: 'error',
                });
                cronLogger('cron check', {
                    status: 'error',
                    reason: '인증에 실패했습니다 (1)',
                    id,
                });
            }
            return new Response('Unauthorized', {
                status: 401,
            });
        }
        supabase = createSuperClient();
    }

    let data: any = null;
    let error: any = null;

    if (userIdParam) {
        // user_id가 제공된 경우 해당 user_id에 속한 모든 작업을 즉시 실행
        embeddingLogger(`Processing jobs for user_id: ${userIdParam}`);

        ({ data, error } = await supabase
            .from('job_queue')
            .select('*')
            .eq('user_id', userIdParam)
            .in('status', ['PENDING', 'RUNNING'])
            .order('scheduled_time', { ascending: true }));
    } else {
        // user_id가 제공되지 않은 경우 기존 로직대로 scheduled_time을 기준으로 작업 조회
        ({ data, error } = await supabase
            .from('job_queue')
            .select('*')
            .lt('scheduled_time', new Date().toISOString())
            .in('status', ['PENDING', 'RUNNING'])
            .order('scheduled_time', { ascending: true }));
    }

    if (error) {
        if (checkInId) {
            const id = captureCheckIn({
                checkInId,
                monitorSlug,
                status: 'error',
            });
            cronLogger('cron check', {
                status: 'error',
                reason: '인증에 실패했습니다 (2)',
                id,
            });
        }
        throw new Error(error.message);
    }

    if (data.length > 0) {
        embeddingLogger('job_queue에서 데이터를 가져왔습니다.', data.length);
    }

    interface Job {
        id: string;
        job_name: string;
        payload: string | null;
        user_id: string;
        created_at: string | null;
        last_running_at: string | null;
        scheduled_time: string;
        status: 'PENDING' | 'RUNNING' | 'FAIL' | null;
    }
    await pMap(
        data,
        async (job: Job) => {
            // user_id가 제공된 경우 scheduled_time을 업데이트하지 않고 즉시 실행
            if (!userIdParam) {
                const scheduledTime = new Date();
                scheduledTime.setMinutes(
                    scheduledTime.getMinutes() + 30 + Math.floor(Math.random() * 30)
                );
                const params = {
                    status: 'RUNNING' as 'RUNNING',
                    last_running_at: new Date().toISOString(),
                    scheduled_time: scheduledTime.toISOString(),
                };
                embeddingLogger('RUNNING', 'params:', params);
                await supabase.from('job_queue').update(params).eq('id', job.id);
            } else {
                // user_id가 제공된 경우 상태만 RUNNING으로 업데이트
                const params = {
                    status: 'RUNNING' as 'RUNNING',
                    last_running_at: new Date().toISOString(),
                };
                embeddingLogger('RUNNING (Immediate)', 'params:', params);
                await supabase.from('job_queue').update(params).eq('id', job.id);
            }

            if (job.job_name === 'EMBEDDING') {
                embeddingLogger('processDocument', job.payload, job.user_id);
                try {
                    await processDocument(supabase, 'page', job.payload, job.user_id);
                } catch (error: any) {
                    if (error.code === 'PGRST116') {
                        embeddingLogger(
                            'job은 존재하나, page 데이터가 없어서 job을 삭제합니다.',
                            'job id:',
                            job.id,
                            'page id:',
                            job.payload
                        );
                        await supabase.from('job_queue').delete().eq('id', job.id);
                        return;
                    }
                }
                let deleteJobError;
                if (userIdParam) {
                    const result = await supabase
                        .from('job_queue')
                        .delete()
                        .eq('id', job.id)
                        .eq('user_id', userIdParam);
                    deleteJobError = result.error;
                } else {
                    const result = await supabase.from('job_queue').delete().eq('id', job.id);
                    deleteJobError = result.error;
                }
                if (deleteJobError) {
                    embeddingLogger(`Error deleting job ${job.id}: ${deleteJobError.message}`);
                    captureMessage(`Error deleting job ${job.id}: ${deleteJobError.message}`);
                    // Optionally, handle errors more gracefully here
                }
            }
        },
        { concurrency: 100 }
    );

    embeddingLogger(
        'duration : ',
        (performance.now() - startTime) / 1000,
        's',
        ', length : ',
        // @ts-ignore
        data.length,
        ', performance : ',
        // @ts-ignore
        (performance.now() - startTime) / 1000 / data.length,
        'job/s'
    );
    if (checkInId) {
        const id = captureCheckIn({
            checkInId,
            monitorSlug,
            status: 'ok',
        });
        cronLogger('cron check', {
            status: 'ok',
            id,
        });
    }
    await flush(2000);
    return new Response(JSON.stringify({ result: data }), {
        headers: { 'Content-Type': 'application/json' },
    });
}

// @ts-ignore
async function processDocument(supabase, type, id, user_id) {
    const content = await fetchData(supabase, type, id);

    const docOutput = await splitDocument(content);

    await deleteDocument(supabase, id);

    await embedAndInsertDocuments(supabase, docOutput, type, content.title, id, user_id);
}

// @ts-ignore
async function fetchData(supabase, type, id) {
    const { data, error } = await supabase.from(type).select('*').eq('id', id).single();

    if (error) {
        throw error;
    }

    return data;
}

// @ts-ignore
async function splitDocument(content) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: RAG_SEARCH_MIN_LENGTH_THRESHOLD,
        chunkOverlap: 1,
    });

    const pageContent = `<h1>${content.title}</h1>${htmlToPlainText(content.body)}`;
    return await splitter.splitDocuments([
        new Document({
            pageContent,
        }),
    ]);
}

function htmlToPlainText(html: string) {
    return convert(html, {
        selectors: [
            { selector: 'a', format: 'skip' },
            { selector: 'img', format: 'skip' },
        ],
    });
}

// @ts-ignore
async function deleteDocument(supabase, id) {
    const { error } = await supabase.from('documents').delete().eq('page_id', id);

    if (error) {
        embeddingLogger('Error deleting document: ', error);
        throw error;
    }
}

async function embedAndInsertDocuments(
    // @ts-ignore
    supabase,
    // @ts-ignore
    docOutput,
    // @ts-ignore
    type,
    // @ts-ignore
    title,
    // @ts-ignore
    id,
    // @ts-ignore
    user_id
) {
    for (const doc of docOutput) {
        const result = await createEmbeddingUsingCohere(doc.pageContent);
        const origin = result.texts[0];
        const converted = result.embeddings[0];
        const tokens = result.meta.billed_units.input_tokens;
        await insertData(supabase, origin, converted, type, title, id, user_id);
        // supabase
        //   .from("api_usage_raw")
        //   .insert({
        //     api_type_id: 5,
        //     amount: tokens,
        //     usage_purpose: 1,
        //     user_id,
        //   })
        //   //@ts-ignore
        //   .then(({ error: rawError }) => {
        //     if (rawError) {
        //       reportErrorToSentry(
        //         "api_usage_raw를 기록하는 과정에서 에러가 발생했습니다.",
        //       );
        //     }
        //   });
    }
}

async function insertData(
    // @ts-ignore
    supabase,
    // @ts-ignore
    origin,
    // @ts-ignore
    converted,
    // @ts-ignore
    type,
    // @ts-ignore
    title,
    // @ts-ignore
    id,
    // @ts-ignore
    user_id
) {
    embeddingLogger('created document', id);
    const { error } = await supabase.from('documents').insert({
        content: origin,
        embedding: converted,
        metadata: {
            type,
            title,
        },
        page_id: id,
        user_id,
    });

    if (error) {
        embeddingLogger('Error inserting data: ', error);
        throw error;
    }
}
