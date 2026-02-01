// @ts-ignore
import { embed } from 'ai';
// @ts-ignore
import { gateway } from '@ai-sdk/gateway';
// @ts-ignore
import { createOpenAI } from '@ai-sdk/openai';
// @ts-ignore
import { EMBEDDING_MODEL_NAME } from '../constants';

/**
 * Vercel AI Gateway를 사용하여 텍스트 임베딩을 생성합니다.
 * 개발 환경에서는 OpenAI 직접 호출, 프로덕션에서는 Gateway 사용
 *
 * @param {string} text - 임베딩할 텍스트
 * @returns {Promise<{embeddings: number[][], texts: string[], meta: {billed_units: {input_tokens: number}}}>}
 */
// @ts-ignore
export async function createEmbedding(text) {
    try {
        const isDevelopment = process.env.NODE_ENV === 'development';

        // 개발 환경에서는 OpenAI 직접 사용, 프로덕션에서는 Gateway 사용
        const embeddingModel = isDevelopment
            ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).textEmbeddingModel(
                  'text-embedding-3-small'
              )
            : gateway.textEmbeddingModel(EMBEDDING_MODEL_NAME);

        const result = await embed({
            model: embeddingModel,
            value: text,
        });

        // 기존 Cohere API 응답 형식과 호환되는 형태로 변환
        // 호출하는 코드에서 result.embeddings[0], result.texts[0], result.meta.billed_units.input_tokens 형태로 사용
        return {
            embeddings: [result.embedding],
            texts: [text],
            meta: {
                billed_units: {
                    input_tokens: result.usage?.tokens || 0,
                },
            },
        };
    } catch (e) {
        console.error(e);
        const errorText = `Embedding API 오류: ${e.message}`;
        console.error('AI error:', new Error(errorText), {
            tags: {
                api: 'embedding',
                provider: process.env.NODE_ENV === 'development' ? 'openai' : 'gateway',
            },
            extra: {
                message: e.message,
            },
        });
        throw e;
    }
}

export async function fetchTitling(id, body) {
    try {
        const response = await fetch('/api/ai/titling', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, body: body }),
        });

        if (!response.ok) {
            // HTTP 429 (사용량 한도 초과) 처리
            if (response.status === 429) {
                try {
                    const errorData = await response.json();

                    // OTU 사용량 한도 초과 vs OpenAI API 한도 초과 구분
                    const isUserQuotaExceeded = errorData.errorCode === 'USER_QUOTA_EXCEEDED';
                    const isExternalRateLimit =
                        errorData.errorCode === 'EXTERNAL_SERVICE_RATE_LIMIT';

                    if (isUserQuotaExceeded) {
                        // OTU 사용량 한도 초과 - 리셋 날짜 정보 포함
                        const quotaError = new Error(
                            errorData.message ||
                                '월간 AI 사용량이 초과되었습니다. 다음 달에 다시 시도해주세요.'
                        );
                        quotaError.isQuotaExceeded = true;
                        quotaError.status = 429;
                        quotaError.resetInfo = errorData.message; // "다음 초기화 일자: ..." 포함
                        throw quotaError;
                    } else if (isExternalRateLimit) {
                        // OpenAI API 한도 초과 - 재시도 안내
                        const rateLimitError = new Error(
                            errorData.message ||
                                'OpenAI API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
                        );
                        rateLimitError.isExternalRateLimit = true;
                        rateLimitError.status = 429;
                        throw rateLimitError;
                    } else {
                        // 하위 호환성: errorCode가 없는 경우 기존 동작 유지
                        const quotaError = new Error(
                            errorData.message ||
                                '월간 AI 사용량이 초과되었습니다. 다음 달에 다시 시도해주세요.'
                        );
                        quotaError.isQuotaExceeded = true;
                        quotaError.status = 429;
                        quotaError.resetInfo = errorData.message;
                        throw quotaError;
                    }
                } catch (parseError) {
                    // parseError가 quotaError 또는 rateLimitError인 경우 그대로 throw
                    if (parseError.isQuotaExceeded || parseError.isExternalRateLimit) {
                        throw parseError;
                    }

                    // 실제 JSON 파싱 실패는 서버 오류로 처리
                    console.error('HTTP 429 응답의 JSON 파싱 실패:', parseError);
                    console.error('AI error:', parseError, {
                        tags: {
                            api: 'titling',
                            status: 429,
                            errorType: 'json_parse_failure',
                        },
                        extra: {
                            parseError: parseError.message,
                        },
                    });

                    throw new Error(
                        `Titling API 응답 파싱 실패: ${response.status} ${response.statusText}`
                    );
                }
            }

            // 기타 HTTP 에러 처리
            const errorText = `Titling API 응답 오류: ${response.status} ${response.statusText}`;
            console.error('AI error:', new Error(errorText), {
                tags: {
                    api: 'titling',
                    status: response.status,
                },
                extra: {
                    id,
                    status: response.status,
                    statusText: response.statusText,
                },
            });
            throw new Error(errorText);
        }

        const responseData = await response.json();
        return responseData;
    } catch (e) {
        // 한도 초과 에러는 예상된 사용자 행동이므로 Sentry에 보고하지 않음
        if (e.isQuotaExceeded) {
            throw e;
        }

        // 이미 처리되지 않은 에러는 Sentry로 보고
        if (!e.message || !e.message.includes('Titling API 응답 오류')) {
            console.error('AI error:', e, {
                tags: {
                    api: 'titling',
                },
                extra: {
                    id,
                    message: e.message,
                },
            });
        }
        throw e;
    }
}
