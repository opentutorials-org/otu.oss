import { captionLogger } from '@/debug/caption';
import {
    TEXT_MODEL_NAME,
    SECURITY_PROMPT,
    parseLocaleFromAcceptLanguage,
    defaultLocale,
} from '@/functions/constants';
import { createClient } from '@/supabase/utils/server';
import { getServerI18n } from '@/lib/lingui';
import { msg } from '@lingui/core/macro';
import { canUseAI, getAIDisabledReason, getAIProvider } from '@/functions/ai/config';

export const runtime = 'nodejs';
export const maxDuration = 60;

import { generateObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

function changePreviewSize(url: string, replace = '/preview/512x512/'): string {
    captionLogger('URL 변경 시작', { originalUrl: url, replacePattern: replace });
    const pattern = /\/preview\/\d+x\d+\//;
    const newUrl = url.replace(pattern, replace);
    captionLogger('URL 변경 완료', { originalUrl: url, newUrl });
    return newUrl;
}

async function processImage(
    detail: 'low' | 'high',
    rezied_image_url: string,
    prompt: string,
    schema: any,
    userId: string
): Promise<{ parsed: any }> {
    try {
        captionLogger('이미지 처리 시작', {
            detail,
            rezied_image_url,
            promptLength: prompt.length,
        });

        captionLogger('Vercel AI SDK 호출 시작', { model: TEXT_MODEL_NAME, detail });

        // AI Provider에 따라 모델 선택
        const provider = getAIProvider();

        const model =
            provider === 'openai'
                ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(TEXT_MODEL_NAME || 'gpt-4o')
                : gateway(TEXT_MODEL_NAME);

        const { object: parsed, usage } = await generateObject({
            model: model as any,
            schema,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt,
                        },
                        {
                            type: 'image',
                            image: rezied_image_url,
                        },
                    ],
                },
            ],
            temperature: 0,
        });

        captionLogger('Vercel AI SDK 응답 수신', {
            hasParsed: !!parsed,
            hasUsage: !!usage,
            usage: usage,
        });

        captionLogger('파싱된 응답', { parsed });
        return { parsed };
    } catch (error) {
        captionLogger('이미지 처리 에러', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            detail,
            rezied_image_url,
        });
        console.error(error);
        throw new Error('An error occurred while processing the request.');
    }
}

/**
 * OCR 결과를 안전하게 처리하는 함수
 * XSS 공격을 방지하기 위해 위험한 HTML 태그를 제거하고 줄바꿈을 처리합니다.
 */
function sanitizeOcrContent(content: string): string {
    if (!content) return '';

    // 먼저 위험한 HTML 태그들을 제거 (script, style, iframe 등)
    let processedContent = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/<link\b[^>]*>/gi, '')
        .replace(/<meta\b[^>]*>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // onclick, onload 등 이벤트 핸들러 제거
        .replace(/javascript:/gi, '') // javascript: 프로토콜 제거
        .replace(/vbscript:/gi, '') // vbscript: 프로토콜 제거
        .replace(/data:/gi, ''); // data: 프로토콜 제거

    // 일반 줄바꿈 문자를 <br> 태그로 변환
    processedContent = processedContent.replace(/\n/g, '<br>');

    // 연속된 공백을 &nbsp;로 변환하여 들여쓰기 보존
    processedContent = processedContent.replace(/  +/g, (match: string) =>
        '&nbsp;'.repeat(match.length)
    );

    return processedContent;
}

export async function POST(req: Request) {
    captionLogger('POST 요청 시작', { timestamp: new Date().toISOString() });

    // AI 기능 활성화 여부 확인
    if (!canUseAI()) {
        const reason = getAIDisabledReason();
        captionLogger('AI captioning disabled', { reason });
        return new Response(
            JSON.stringify({
                result: {
                    title: '',
                    description: '',
                    isText: false,
                    needHighRes: false,
                    ocr: '',
                },
            }),
            {
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    try {
        const body = await req.json();
        const id = body.id;
        const image_url = body.image_url;
        const locale = parseLocaleFromAcceptLanguage(body.locale || defaultLocale); // 클라이언트에서 전달한 언어 설정 사용

        captionLogger('POST 요청 바디 파싱 완료', {
            id,
            image_url,
            locale,
            bodyKeys: Object.keys(body),
        });

        if (!image_url) {
            captionLogger('이미지 URL이 없음', { body });
            throw new Error('Image URL is required');
        }

        const supabase = await createClient();
        captionLogger('Supabase 클라이언트 생성 완료', {});

        const user = await supabase.auth.getUser();
        captionLogger('사용자 인증 확인', {
            hasUser: !!user.data.user,
            userId: user.data.user?.id,
            userEmail: user.data.user?.email,
        });

        if (user.data.user === null) {
            captionLogger('사용자 인증 실패', {});
            throw new Error('You must be logged in to use this feature.');
        }

        captionLogger('유저 확인 완료', { userId: user.data.user.id });

        // 다국어 번역 가져오기
        captionLogger('다국어 번역 조회 시작', { locale });
        const i18n = await getServerI18n(locale);
        const defaultPicturePrompt = i18n._(
            msg`이미지의 초점이 문자라면 문자만 출력해주세요. 그렇지 않다면, 보이는 사물을 단어로 나열해주세요. 설명형 문장 사용 금지. 예: 컵, 꽃, 바다, 갈매기`
        );
        captionLogger('기본 프롬프트 조회 완료', { defaultPicturePrompt });

        // 사용자의 커스텀 프롬프트 확인
        captionLogger('커스텀 프롬프트 조회 시작', { userId: user.data.user.id });
        const { data: customPromptData, error: customPromptError } = await supabase
            .from('custom_prompts')
            .select('photo_prompt')
            .eq('user_id', user.data.user.id)
            .single();

        captionLogger('커스텀 프롬프트 조회 완료', {
            customPromptData,
            customPromptError,
            hasCustomPrompt: !!customPromptData?.photo_prompt,
        });

        const userPrompt = customPromptData?.photo_prompt || defaultPicturePrompt;
        captionLogger('최종 사용자 프롬프트', { userPrompt });

        // 언어에 따라 출력 언어 설정
        const outputLanguage = locale === 'ko' ? 'Korean' : 'English';
        captionLogger('출력 언어 설정', { locale, outputLanguage });

        const prompt = `
        title: A Descriptive Title for the Image in ${outputLanguage},
        isText: true if there is text, false if there is no text. Output in ${outputLanguage}. 
        needHighRes: true if text is blurry/unclear, has a lot of text content, or contains important information (documents, signs, business cards, etc.), false otherwise.
        description: ${userPrompt} in ${outputLanguage}.
        
        ${SECURITY_PROMPT.COMBINED}`;
        captionLogger('최종 프롬프트 생성', { prompt });

        const url = changePreviewSize(image_url, '');
        captionLogger('이미지 URL 처리 완료', { originalUrl: image_url, processedUrl: url });

        const schema1 = z.object({
            title: z.string(),
            description: z.string(),
            isText: z.boolean(),
            needHighRes: z.boolean(),
        });

        captionLogger('저해상도 이미지 처리 시작', {});
        let { parsed } = await processImage('low', url, prompt, schema1, user.data.user.id);
        captionLogger('저해상도 이미지 처리 완료', { parsed });

        if (parsed.isText === true && parsed.needHighRes === true) {
            captionLogger('텍스트 감지됨 및 고해상도 처리 필요 - 고해상도 처리 시작', {});
            const highResPrompt = `title: A Descriptive Title for the Image,
ocr: HTML format, emphasize key points, leave blank if no text, convert only important information to text, ignore anything that is unclear, use <br> tags for line breaks, prefer lists or tables. Output in ${outputLanguage}.

${SECURITY_PROMPT.COMBINED}`;
            const highResUrl = changePreviewSize(
                image_url,
                '/preview/1024x1024/-/quality/lightest/'
            );
            captionLogger('고해상도 이미지 URL 생성', { highResUrl });

            const schema2 = z.object({
                title: z.string(),
                ocr: z.string(),
            });

            const result = await processImage(
                'high',
                highResUrl,
                highResPrompt,
                schema2,
                user.data.user.id
            );
            captionLogger('고해상도 이미지 처리 완료', { result: result.parsed });

            // 저해상도에서 얻은 description과 고해상도에서 얻은 ocr 정보를 함께 저장
            const originalDescription = parsed.description;
            parsed = result.parsed;

            // OCR 결과의 안전한 처리
            let ocrContent = sanitizeOcrContent(parsed.ocr || '');

            parsed.ocr = originalDescription + '<br><br>' + ocrContent;
            captionLogger('텍스트가 있고 고해상도 처리한 경우 최종 파싱 결과', { parsed });
        } else if (parsed.isText === true && parsed.needHighRes === false) {
            // 텍스트는 있지만 고해상도 처리가 불필요한 경우
            parsed.ocr = sanitizeOcrContent(parsed.description);
            captionLogger('텍스트가 있지만 저해상도로 충분한 경우 최종 파싱 결과', { parsed });
        } else {
            parsed.ocr = sanitizeOcrContent(
                parsed.ocr ? parsed.ocr : parsed.description ? parsed.description : ''
            );
            captionLogger('텍스트가 없는 경우 최종 파싱 결과', { parsed });
        }

        captionLogger('최종 응답 준비', { finalParsed: parsed });
        const response = new Response(JSON.stringify({ result: parsed }), {
            headers: { 'Content-Type': 'application/json' },
        });

        captionLogger('POST 요청 처리 완료', { timestamp: new Date().toISOString() });
        return response;
    } catch (error) {
        captionLogger('POST 요청 처리 중 에러', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
        });
        console.error(error);
        return new Response(
            JSON.stringify({
                error: 'An error occurred while processing the request.',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
