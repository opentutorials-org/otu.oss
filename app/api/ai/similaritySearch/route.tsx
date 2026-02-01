import { cookies } from 'next/headers';
import { createEmbedding } from '@/functions/ai';
import errorResponse, { successResponse } from '@/functions/response';
import { chatLogger } from '@/debug/chat';
import { createClient } from '@/supabase/utils/server';
import { getServerI18n } from '@/lib/lingui';
import { msg } from '@lingui/core/macro';
import { parseLocaleFromAcceptLanguage } from '@/functions/constants';
import { canUseEmbeddings, getEmbeddingsDisabledReason } from '@/functions/ai/config';

// 셀프호스팅 환경에서 edge runtime은 Node.js 전용 모듈과 호환되지 않으므로
// nodejs runtime을 사용합니다.
export const runtime = 'nodejs';

export async function POST(req: Request) {
    const locale = parseLocaleFromAcceptLanguage(req.headers.get('accept-language'));
    const i18n = await getServerI18n(locale);

    // 임베딩/RAG 기능 활성화 여부 확인
    if (!canUseEmbeddings()) {
        const reason = getEmbeddingsDisabledReason();
        chatLogger('Similarity search disabled', { reason });
        // 빈 결과 반환 (RAG 없이 진행)
        return new Response(JSON.stringify({ data: [] }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    if (user.data.user === null) {
        return errorResponse(
            {
                message: i18n._(msg`로그인이 필요합니다.`),
            },
            new Error('session.data.session is null')
        );
    }
    const c = await cookies();
    const body = await req.json();
    const page_id = body.page_id;
    const count = body.count || 3;
    const threshold = body.threshold || 0.55;

    let embedQuery;
    try {
        const embeddings = await createEmbedding(body.inputMessage);
        embedQuery = embeddings.embeddings[0];
    } catch (error) {
        return errorResponse(
            {
                status: 500,
                errorCode: 'FAIL_FETCH_FROM_DATABASE',
                data: {},
                meta: {},
                message: i18n._(
                    msg`관련된 글을 찾는 과정에서 오류가 발생했습니다. 잠시 후 다시 시도해보세요.`
                ),
            },
            error
        );
    }

    const match_documents_options = {
        // PostgreSQL 벡터 타입은 JSON 문자열로 전달해야 함
        query_embedding: JSON.stringify(embedQuery),
        match_threshold: threshold,
        match_count: Math.min(10, count),
        input_page_id: page_id,
    };
    const result = await supabase.rpc('match_documents', match_documents_options);
    if (result.error) {
        return errorResponse(
            {
                message: i18n._(
                    msg`관련된 글을 찾는 과정에서 오류가 발생했습니다. 잠시 후 다시 시도해보세요.`
                ),
            },
            result.error
        );
    }
    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
    });
}
