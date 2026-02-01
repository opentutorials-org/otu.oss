// route.tsx

import { NextRequest } from 'next/server';
import { streamText, CoreMessage } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import errorResponse from '@/functions/response';
import { generatePrompt, generateInstructions } from '@/functions/ai/vercel/prompt';
import { extractContextMessages } from '@/functions/ai/vercel/extractContextMessages';
import { createClient } from '@/supabase/utils/server';
import { responseByStream } from '@/functions/ai/vercel/responseByStream';
import { askLLMRequestType } from '@/functions/ai/vercel/type';
import { aiLogger } from '@/debug/ai';
import { TEXT_MODEL_NAME } from '@/functions/constants';
import { getServerI18n } from '@/lib/lingui';
import { msg } from '@lingui/core/macro';
import { logHeader } from '@/functions/logHeader';
import { parseLocaleFromAcceptLanguage } from '@/functions/constants';
import { canUseAI, getAIDisabledReason, getAIProvider } from '@/functions/ai/config';

// 셀프호스팅 환경에서 edge runtime은 Node.js 전용 모듈(pg 등)과 호환되지 않으므로
// nodejs runtime을 사용합니다. Vercel 배포 시에도 nodejs runtime으로 동작합니다.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    aiLogger(`Request received`);
    const locale = parseLocaleFromAcceptLanguage(req.headers.get('accept-language'));
    const i18n = await getServerI18n(locale);
    logHeader(req);
    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    aiLogger(`getUser completed: ${Date.now() - startTime}ms`);
    if (user.data.user === null) {
        return responseByStream(i18n._(msg`채팅 기능을 사용하기 위해서는 로그인이 필요합니다.`));
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
        return responseByStream(i18n._(msg`AI 기능이 설정되지 않았습니다. 관리자에게 문의하세요.`));
    }

    if (TEXT_MODEL_NAME === undefined) {
        return errorResponse(
            {
                errorCode: 'INVALID_MODEL',
                message: i18n._(msg`모델 정보가 잘못되었습니다.`),
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

        // AI Provider에 따라 모델 선택
        const provider = getAIProvider();

        const model =
            provider === 'openai'
                ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(TEXT_MODEL_NAME || 'gpt-4o')
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
                errorCode: 'FAIL_OPENAI_CHAT_COMPLETIONS_CREATE',
                data: {},
                meta: {},
                message: i18n._(msg`AI 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해보세요.`),
            },
            e
        );
    }
}
