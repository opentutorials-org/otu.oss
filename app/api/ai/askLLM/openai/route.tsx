// route.tsx

import { NextRequest } from 'next/server';
import { streamText, CoreMessage } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { createTranslator } from 'next-intl';
import messages from '@/messages/ko.json';

import errorResponse from '@/functions/response';
import { generatePrompt, generateInstructions } from '@/functions/ai/vercel/prompt';
import { extractContextMessages } from '@/functions/ai/vercel/extractContextMessages';
import { createClient } from '@/supabase/utils/server';
import { responseByStream } from '@/functions/ai/vercel/responseByStream';
import { askLLMRequestType } from '@/functions/ai/vercel/type';
import { aiLogger } from '@/debug/ai';
import { TEXT_MODEL_NAME } from '@/functions/constants';
import { getTranslations } from 'next-intl/server';
import { logHeader } from '@/functions/logHeader';
import { parseLocaleFromAcceptLanguage } from '@/functions/constants';
import { canUseAI, getAIDisabledReason, getAIProvider } from '@/functions/ai/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    aiLogger(`Request received`);
    const locale = parseLocaleFromAcceptLanguage(req.headers.get('accept-language'));
    const t = await getTranslations({ locale });
    logHeader(req);
    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    aiLogger(`getUser completed: ${Date.now() - startTime}ms`);
    if (user.data.user === null) {
        return responseByStream(t('api.errors.login-required'));
    }

    const body: askLLMRequestType = await req.json();
    aiLogger(`req.json() completed: ${Date.now() - startTime}ms`);
    const { message, references, history } = body;
    if (message === '') {
        throw new Error('messages is empty');
    }
    // AI 기능 활성화 여부 확인
    if (!canUseAI()) {
        const reason = getAIDisabledReason();
        aiLogger(`AI disabled: ${reason}`);
        return responseByStream(t('api.errors.ai-not-configured'));
    }

    if (TEXT_MODEL_NAME === undefined) {
        return errorResponse(
            {
                errorCode: 'INVALID_MODEL',
                message: t('api.errors.model-invalid'),
            },
            new Error('INVALID_MODEL')
        );
    }
    let contextMessages = extractContextMessages({
        contextLength: 2,
        history,
        roleKey: 'role',
        contentKey: 'content',
        userName: 'user',
        assistantName: 'assistant',
    });
    aiLogger('extract context history', contextMessages);

    const systemInstructions = generateInstructions();
    aiLogger('system instructions', systemInstructions);

    let prompt = generatePrompt(references, message, 'user', 'assistant');
    aiLogger('prompt', prompt);

    // CoreMessage 타입으로 변환
    const coreMessages: CoreMessage[] = [
        { role: 'system', content: systemInstructions },
        ...contextMessages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content as string,
        })),
        { role: 'user', content: prompt },
    ];
    aiLogger('messages', coreMessages);

    try {
        aiLogger(`Before streamText: ${Date.now() - startTime}ms`);

        // AI_PROVIDER에 따라 OpenAI 직접 사용 또는 Gateway 사용
        const model =
            getAIProvider() === 'openai'
                ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })('gpt-4o')
                : gateway(TEXT_MODEL_NAME);

        const result = streamText({
            model: model as any,
            messages: coreMessages,
        });

        return result.toTextStreamResponse();
    } catch (e: any) {
        if (e?.status === 429) {
            return errorResponse(
                {
                    status: 429,
                    errorCode: 'EXTERNAL_SERVICE_RATE_LIMIT',
                    data: {},
                    meta: {},
                    message: t('api.errors.external-rate-limit'),
                },
                e
            );
        }
        return errorResponse(
            {
                status: 500,
                errorCode: 'FAIL_OPENAI_CHAT_COMPLETIONS_CREATE',
                data: {},
                meta: {},
                message: t('api.errors.ai-request-failed'),
            },
            e
        );
    }
}
