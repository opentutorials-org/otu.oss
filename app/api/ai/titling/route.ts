import { TEXT_MODEL_NAME, parseLocaleFromAcceptLanguage } from '@/functions/constants';
import errorResponse, { successResponse } from '@/functions/response';
import { createClient } from '@/supabase/utils/server';
import { getTranslations } from 'next-intl/server';
import { aiLogger } from '@/debug/ai';
import { generateObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { canUseAI, getAIDisabledReason, getAIProvider } from '@/functions/ai/config';

export const maxDuration = 60;
export const runtime = 'nodejs';

const titleGenerationSchema = z.object({
    title: z
        .string()
        .describe(
            '생성된 제목 - 간결하고 명확하며 독자의 관심을 끄는 제목. 접두사나 설명 없이 순수 제목만 포함'
        ),
    language: z.string().describe('실제로 생성된 제목의 언어 코드'),
});

export async function POST(req: Request) {
    const locale = parseLocaleFromAcceptLanguage(req.headers.get('accept-language'));
    const t = await getTranslations({ locale });

    // AI 기능 활성화 여부 확인
    if (!canUseAI()) {
        const reason = getAIDisabledReason();
        aiLogger('AI titling disabled', { reason });
        return successResponse({
            status: 200,
            message: t('api.ai.titling.disabled'),
            data: { createdTitle: '' },
        });
    }

    const body = await req.json();
    const contentBody = body.body;

    const userResponse = await authenticateUser(t);
    if ('error' in userResponse) return userResponse.error;

    try {
        const { content } = await generateTitle(contentBody, locale);

        return successResponse({
            status: 200,
            message: t('api.ai.search.success'),
            data: { createdTitle: content },
        });
    } catch (e: any) {
        console.error('AI titling error:', e);
        if (e?.status === 429) {
            return errorResponse(
                {
                    status: 429,
                    errorCode: 'EXTERNAL_SERVICE_RATE_LIMIT',
                    message: t('api.errors.external-rate-limit'),
                },
                e
            );
        }
        return errorResponse(
            { status: 500, errorCode: 'FAIL_TITLING', message: t('api.ai.titling.failed') },
            e
        );
    }
}

async function authenticateUser(t: any) {
    const supabase = await createClient();
    const user = await supabase.auth.getUser();

    if (user.data.user === null) {
        return {
            error: errorResponse(
                { status: 500, errorCode: 'NEED_LOGIN', message: t('api.ai.titling.failed') },
                new Error(
                    'AI 제목을 짓기 위해서는 로그인이 필요합니다. 이 문제는 로그인이 되어 있지 않아서 발생했습니다.'
                )
            ),
        };
    }

    return { user: user.data.user };
}

async function generateTitle(contentBody: string, locale: string | null) {
    const extractContent = (text: string) =>
        text.length <= 300
            ? text
            : `${text.substring(0, 150)}...${text.substring(text.length - 150)}`;

    const targetLanguage = locale?.split('-')[0] || 'ko';
    const extractedContent = extractContent(contentBody);

    aiLogger('AI 제목 생성 요청 (Tools)', {
        contentLength: contentBody.length,
        extractedLength: extractedContent.length,
        locale: targetLanguage,
    });

    try {
        // AI_PROVIDER에 따라 OpenAI 직접 사용 또는 Gateway 사용
        const model =
            getAIProvider() === 'openai'
                ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })('gpt-4o')
                : gateway(TEXT_MODEL_NAME);

        const { object, usage } = await generateObject({
            model: model as any,
            schema: titleGenerationSchema,
            messages: [
                {
                    role: 'user',
                    content: `Content: ${extractedContent}\nTarget Language: ${targetLanguage}\n\nPlease generate an appropriate title for this content.`,
                },
            ],
            temperature: 0.7,
        });

        aiLogger('AI 제목 생성 완료', {
            title: object.title,
            language: object.language,
            usage,
        });

        return {
            content: object.title,
            usage,
        };
    } catch (error) {
        console.error('Tool call response parsing error:', error);
        throw new Error('AI 응답을 파싱하는데 실패했습니다.');
    }
}
