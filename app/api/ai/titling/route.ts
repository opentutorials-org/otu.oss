import { TEXT_MODEL_NAME, parseLocaleFromAcceptLanguage } from '@/functions/constants';
import errorResponse, { successResponse } from '@/functions/api/response';
import { createClient } from '@/supabase/utils/server';
import { getServerI18n } from '@/lib/lingui';
import { msg } from '@lingui/core/macro';
import type { I18n } from '@lingui/core';
import { aiLogger } from '@/debug/ai';
import { generateObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { canUseAI, getAIDisabledReason } from '@/functions/ai/config';

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
    const i18n = await getServerI18n(locale);

    // AI 기능 활성화 여부 확인
    if (!canUseAI()) {
        const reason = getAIDisabledReason();
        aiLogger('AI titling disabled', { reason });
        return successResponse({
            status: 200,
            message: i18n._(msg`AI 제목 생성 기능이 비활성화되어 있습니다.`),
            data: { createdTitle: '' },
        });
    }

    let body;
    try {
        body = await req.json();
    } catch (parseError) {
        return errorResponse(
            {
                status: 400,
                errorCode: 'INVALID_JSON',
                message: i18n._(msg`잘못된 요청 형식입니다.`),
            },
            parseError instanceof Error ? parseError : new Error('Invalid JSON body')
        );
    }
    const contentBody = body.body;
    if (!contentBody) {
        return errorResponse(
            {
                status: 400,
                errorCode: 'EMPTY_BODY',
                message: i18n._(msg`제목을 생성할 본문이 필요합니다.`),
            },
            new Error('body is required')
        );
    }

    const userResponse = await authenticateUser(i18n);
    if ('error' in userResponse) return userResponse.error;

    try {
        const { content } = await generateTitle(contentBody, locale);

        return successResponse({
            status: 200,
            message: i18n._(msg`성공적으로 처리했습니다.`),
            data: { createdTitle: content },
        });
    } catch (e: any) {
        console.error('AI titling error:', e);
        if (e?.status === 429) {
            return errorResponse(
                {
                    status: 429,
                    errorCode: 'EXTERNAL_SERVICE_RATE_LIMIT',
                    message: i18n._(
                        msg`일시적으로 요청이 많아 처리할 수 없습니다. 잠시 후 다시 시도해주세요.`
                    ),
                },
                e
            );
        }
        return errorResponse(
            {
                status: 500,
                errorCode: 'FAIL_TITLING',
                message: i18n._(msg`AI가 제목을 짓지 못했습니다.`),
            },
            e
        );
    }
}

async function authenticateUser(i18n: I18n) {
    const supabase = await createClient();
    const user = await supabase.auth.getUser();

    if (user.data.user === null) {
        return {
            error: errorResponse(
                {
                    status: 500,
                    errorCode: 'NEED_LOGIN',
                    message: i18n._(msg`AI가 제목을 짓지 못했습니다.`),
                },
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
        // 로컬 환경에서는 OpenAI 직접 사용, 프로덕션에서는 Gateway 사용
        const isDevelopment = process.env.NODE_ENV === 'development';

        const model = isDevelopment
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
