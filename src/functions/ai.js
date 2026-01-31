// @ts-ignore
import * as Sentry from '@sentry/nextjs';

// @ts-ignore
export async function createEmbeddingUsingCohere(text, input_type = 'search_query') {
    try {
        const bodyContent = {
            model: 'embed-multilingual-v3.0',
            texts: [text],
            truncate: 'NONE',
            input_type: input_type,
        };

        const response = await fetch('https://api.cohere.ai/v1/embed', {
            headers: {
                'content-type': 'application/json; charset=UTF-8',
                authorization: `Bearer ${process.env.COHERE_API_KEY}`,
            },
            body: JSON.stringify(bodyContent),
            method: 'POST',
            mode: 'cors',
            credentials: 'include',
        });

        if (!response.ok) {
            const errorText = `Cohere API 응답 오류: ${response.status} ${response.statusText}`;
            Sentry.captureException(new Error(errorText), {
                tags: {
                    api: 'cohere',
                    endpoint: 'embed',
                    status: response.status,
                },
                extra: {
                    input_type,
                    status: response.status,
                    statusText: response.statusText,
                },
            });
            throw new Error(errorText);
        }

        const data = await response.json();

        if (!data) {
            const errorText = 'Cohere API 응답 데이터가 없습니다.';
            Sentry.captureException(new Error(errorText), {
                tags: {
                    api: 'cohere',
                    endpoint: 'embed',
                },
                extra: {
                    input_type,
                },
            });
            throw new Error(errorText);
        }

        return data;
    } catch (e) {
        console.error(e);
        // 이미 처리되지 않은 에러는 Sentry로 보고
        if (
            !e.message ||
            (!e.message.includes('Cohere API 응답 오류') &&
                !e.message.includes('Cohere API 응답 데이터가 없습니다'))
        ) {
            Sentry.captureException(e, {
                tags: {
                    api: 'cohere',
                    endpoint: 'embed',
                },
                extra: {
                    input_type,
                    message: e.message,
                },
            });
        }
        throw e; // 에러를 다시 던져서 이 함수를 호출한 곳에서도 에러를 처리할 수 있게 합니다.
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
                    Sentry.captureException(parseError, {
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
            Sentry.captureException(new Error(errorText), {
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
            Sentry.captureException(e, {
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
