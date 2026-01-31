export const maxDuration = 300;
import { createEmbedding } from '@/functions/ai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
const { convert } = require('html-to-text');
import pMap from 'p-map';
import { embeddingLogger } from '@/debug/embedding';
import { createClient } from '@/supabase/utils/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database/types';
import {
    RAG_SEARCH_MIN_LENGTH_THRESHOLD,
    parseLocaleFromAcceptLanguage,
} from '@/functions/constants';
import { getTranslations } from 'next-intl/server';
import { canUseEmbeddings, getEmbeddingsDisabledReason } from '@/functions/ai/config';

/**
 * 사용자 트리거 방식의 임베딩 처리 API
 *
 * 이 API는 사용자 인증 기반으로 동작하며, Cron 작업에 의존하지 않습니다.
 * 클라이언트에서 페이지 저장 후 또는 동기화 시점에 직접 호출하여 임베딩을 처리합니다.
 *
 * @param user_id - 필수. 처리할 임베딩 작업의 사용자 ID (로그인한 사용자와 일치해야 함)
 */
export async function GET(request: Request) {
    embeddingLogger('embedding scheduler 시작 (사용자 트리거 방식)');

    // 임베딩 기능 활성화 여부 확인
    if (!canUseEmbeddings()) {
        const reason = getEmbeddingsDisabledReason();
        embeddingLogger('Embedding scheduler disabled', { reason });
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

    const locale = parseLocaleFromAcceptLanguage(request.headers.get('accept-language'));
    const t = await getTranslations({ locale });

    // user_id 파라미터는 필수
    if (!userIdParam) {
        return new Response(
            JSON.stringify({
                message: 'user_id parameter is required',
                processed: 0,
            }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    embeddingLogger('start');
    const startTime = performance.now();

    const supabase: SupabaseClient<Database> = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    embeddingLogger('breadcrumb:', {
        category: 'embedding',
        data: {
            data: authData,
            error: authError,
        },
    });
    if (!authData.user) {
        console.log('인증에 실패했습니다. 이 문제는 무시해도 됩니다.');
        return new Response(t('api.embedding-scheduler.unauthorized'), {
            status: 401,
        });
    }
    if (userIdParam !== authData.user.id) {
        console.log(
            '인증에 실패했습니다. embedding의 user_id와 현재 로그인한 user_id가 일치하지 않습니다. 이 문제가 급격히 증가했다면 조사하십시오.'
        );
        return new Response(t('api.embedding-scheduler.unauthorized'), {
            status: 401,
        });
    }

    // 해당 user_id에 속한 모든 PENDING/RUNNING 작업을 즉시 실행
    embeddingLogger(`Processing jobs for user_id: ${userIdParam}`);

    const { data, error } = await supabase
        .from('job_queue')
        .select('*')
        .eq('user_id', userIdParam)
        .in('status', ['PENDING', 'RUNNING'])
        .order('scheduled_time', { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    if (data.length > 0) {
        embeddingLogger('job_queue에서 데이터를 가져왔습니다.', data.length);
    }

    interface Job {
        id: string;
        job_name: string | null;
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
            // 상태를 RUNNING으로 업데이트
            const params = {
                status: 'RUNNING' as 'RUNNING',
                last_running_at: new Date().toISOString(),
            };
            embeddingLogger('RUNNING (Immediate)', 'params:', params);
            await supabase.from('job_queue').update(params).eq('id', job.id);

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
                const result = await supabase
                    .from('job_queue')
                    .delete()
                    .eq('id', job.id)
                    .eq('user_id', userIdParam);
                if (result.error) {
                    embeddingLogger(`Error deleting job ${job.id}: ${result.error.message}`);
                    console.log(`Error deleting job ${job.id}: ${result.error.message}`);
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
        const result = await createEmbedding(doc.pageContent);
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
