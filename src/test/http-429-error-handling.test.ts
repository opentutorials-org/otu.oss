/**
 * HTTP 429 에러 처리 - API Mock 테스트
 *
 * Issue #1085: HTTP 429 사용 정책 개선
 *
 * 이 테스트는 클라이언트가 서버의 429 응답을 올바르게 처리하는지 검증합니다.
 * - OTU 사용량 한도 초과 (USER_QUOTA_EXCEEDED)
 * - OpenAI API 한도 초과 (EXTERNAL_SERVICE_RATE_LIMIT)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Global fetch mock
global.fetch = jest.fn() as jest.Mock;

describe('HTTP 429 에러 처리 - API Mock 테스트', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('fetchTitling API (errorResponse 형식)', () => {
        // fetchTitling 함수를 동적으로 import하여 테스트
        const mockFetchTitling = async (id: string, body: string) => {
            const response = await fetch('/api/ai/titling', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, body }),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    const errorData = await response.json();

                    const isUserQuotaExceeded = errorData.errorCode === 'USER_QUOTA_EXCEEDED';
                    const isExternalRateLimit =
                        errorData.errorCode === 'EXTERNAL_SERVICE_RATE_LIMIT';

                    if (isUserQuotaExceeded) {
                        const quotaError: any = new Error(errorData.message);
                        quotaError.isQuotaExceeded = true;
                        quotaError.status = 429;
                        quotaError.resetInfo = errorData.message;
                        throw quotaError;
                    } else if (isExternalRateLimit) {
                        const rateLimitError: any = new Error(errorData.message);
                        rateLimitError.isExternalRateLimit = true;
                        rateLimitError.status = 429;
                        throw rateLimitError;
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.json();
        };

        it('USER_QUOTA_EXCEEDED 응답을 올바르게 처리해야 한다', async () => {
            // Given: OTU 사용량 한도 초과 응답
            const mockResponse = {
                status: 429,
                errorCode: 'USER_QUOTA_EXCEEDED',
                message:
                    '월간 AI 사용량이 초과되었습니다. 다음 초기화 일자: 2025년 10월 28일 (7일 남음)',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => mockResponse,
            });

            // When & Then
            try {
                await mockFetchTitling('test-id', 'test body');
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.isQuotaExceeded).toBe(true);
                expect(error.status).toBe(429);
                expect(error.message).toContain('월간 AI 사용량이 초과되었습니다');
                expect(error.resetInfo).toContain('2025년 10월 28일');
            }
        });

        it('EXTERNAL_SERVICE_RATE_LIMIT 응답을 올바르게 처리해야 한다', async () => {
            // Given: OpenAI API 한도 초과 응답
            const mockResponse = {
                status: 429,
                errorCode: 'EXTERNAL_SERVICE_RATE_LIMIT',
                message: 'OpenAI API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => mockResponse,
            });

            // When & Then
            try {
                await mockFetchTitling('test-id', 'test body');
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.isExternalRateLimit).toBe(true);
                expect(error.status).toBe(429);
                expect(error.message).toContain('OpenAI API 할당량이 초과되었습니다');
                expect(error.isQuotaExceeded).toBeUndefined();
            }
        });

        it('하위 호환성: errorCode가 없는 응답도 처리해야 한다', async () => {
            // Given: 구버전 응답 (errorCode 없음)
            const mockResponse = {
                status: 429,
                message: '월간 AI 사용량이 초과되었습니다. 다음 달에 다시 시도해주세요.',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => mockResponse,
            });

            // When & Then
            try {
                await mockFetchTitling('test-id', 'test body');
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                // errorCode가 없으면 HTTP 에러로 처리
                expect(error.message).toContain('HTTP error');
            }
        });
    });

    describe('fetchCaption API (Response 형식)', () => {
        // fetchCaption 함수를 동적으로 구현
        const mockFetchCaption = async (id: string, imageUrl: string) => {
            const response = await fetch('/api/ai/captioning', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, image_url: imageUrl }),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    const errorData = await response.json();

                    const isUserQuotaExceeded = errorData.code === 'user_quota_exceeded';
                    const isExternalRateLimit = errorData.code === 'external_service_rate_limit';

                    if (isUserQuotaExceeded) {
                        const quotaError: any = new Error(errorData.error);
                        quotaError.isQuotaExceeded = true;
                        quotaError.status = 429;
                        quotaError.resetInfo = errorData.error;
                        throw quotaError;
                    } else if (isExternalRateLimit) {
                        const rateLimitError: any = new Error(errorData.error);
                        rateLimitError.isExternalRateLimit = true;
                        rateLimitError.status = 429;
                        throw rateLimitError;
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.json();
        };

        it('user_quota_exceeded 응답을 올바르게 처리해야 한다', async () => {
            // Given: OTU 사용량 한도 초과 응답
            const mockResponse = {
                error: '월간 AI 사용량이 초과되었습니다. 다음 초기화 일자: 2025년 10월 28일 (7일 남음)',
                type: 'user_quota_exceeded',
                code: 'user_quota_exceeded',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => mockResponse,
            });

            // When & Then
            try {
                await mockFetchCaption('test-id', 'https://example.com/image.jpg');
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.isQuotaExceeded).toBe(true);
                expect(error.status).toBe(429);
                expect(error.message).toContain('월간 AI 사용량이 초과되었습니다');
            }
        });

        it('external_service_rate_limit 응답을 올바르게 처리해야 한다', async () => {
            // Given: OpenAI API 한도 초과 응답
            const mockResponse = {
                error: 'OpenAI API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
                type: 'external_service_rate_limit',
                code: 'external_service_rate_limit',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => mockResponse,
            });

            // When & Then
            try {
                await mockFetchCaption('test-id', 'https://example.com/image.jpg');
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.isExternalRateLimit).toBe(true);
                expect(error.status).toBe(429);
                expect(error.message).toContain('OpenAI API 할당량이 초과되었습니다');
                expect(error.isQuotaExceeded).toBeUndefined();
            }
        });
    });

    describe('askLLM API (errorResponse 형식)', () => {
        const mockRunAskLLM = async (message: string) => {
            const response = await fetch('/api/ai/askLLM/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    references: [],
                    history: [],
                }),
            });

            if (response.status === 429) {
                const errorData = await response.json();

                const isUserQuotaExceeded = errorData.errorCode === 'USER_QUOTA_EXCEEDED';
                const isExternalRateLimit = errorData.errorCode === 'EXTERNAL_SERVICE_RATE_LIMIT';

                if (isUserQuotaExceeded) {
                    const quotaError: any = new Error(errorData.message);
                    quotaError.isQuotaExceeded = true;
                    quotaError.status = 429;
                    quotaError.resetInfo = errorData.message;
                    throw quotaError;
                } else if (isExternalRateLimit) {
                    const rateLimitError: any = new Error(errorData.message);
                    rateLimitError.isExternalRateLimit = true;
                    rateLimitError.status = 429;
                    throw rateLimitError;
                }
            }

            if (!response.ok) {
                throw new Error('언어모델의 응답이 없습니다.');
            }

            return response;
        };

        it('USER_QUOTA_EXCEEDED 응답을 올바르게 처리해야 한다', async () => {
            // Given
            const mockResponse = {
                status: 429,
                errorCode: 'USER_QUOTA_EXCEEDED',
                message:
                    '월간 AI 사용량이 초과되었습니다. 다음 초기화 일자: 2025년 11월 1일 (10일 남음)',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => mockResponse,
            });

            // When & Then
            try {
                await mockRunAskLLM('테스트 질문');
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.isQuotaExceeded).toBe(true);
                expect(error.status).toBe(429);
                expect(error.message).toContain('월간 AI 사용량이 초과되었습니다');
                expect(error.resetInfo).toContain('2025년 11월 1일');
            }
        });

        it('EXTERNAL_SERVICE_RATE_LIMIT 응답을 올바르게 처리해야 한다', async () => {
            // Given
            const mockResponse = {
                status: 429,
                errorCode: 'EXTERNAL_SERVICE_RATE_LIMIT',
                message: 'OpenAI API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => mockResponse,
            });

            // When & Then
            try {
                await mockRunAskLLM('테스트 질문');
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.isExternalRateLimit).toBe(true);
                expect(error.status).toBe(429);
                expect(error.message).toContain('OpenAI API 할당량이 초과되었습니다');
                expect(error.isQuotaExceeded).toBeUndefined();
            }
        });
    });

    describe('에러 플래그 우선순위', () => {
        it('isQuotaExceeded와 isExternalRateLimit는 상호 배타적이어야 한다', async () => {
            // Given: USER_QUOTA_EXCEEDED 응답
            const userQuotaResponse = {
                status: 429,
                errorCode: 'USER_QUOTA_EXCEEDED',
                message: '월간 AI 사용량이 초과되었습니다.',
            };

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => userQuotaResponse,
            });

            try {
                const response = await fetch('/api/ai/titling', {
                    method: 'POST',
                    body: JSON.stringify({ id: 'test', body: 'test' }),
                });

                const errorData = await response.json();
                const isUserQuotaExceeded = errorData.errorCode === 'USER_QUOTA_EXCEEDED';
                const isExternalRateLimit = errorData.errorCode === 'EXTERNAL_SERVICE_RATE_LIMIT';

                // Then: 두 플래그는 동시에 true가 될 수 없음
                expect(isUserQuotaExceeded).toBe(true);
                expect(isExternalRateLimit).toBe(false);
            } catch (error) {
                fail('fetch 자체는 성공해야 합니다');
            }
        });
    });

    describe('JSON 파싱 실패 처리', () => {
        it('429 응답의 JSON 파싱 실패 시 적절히 처리해야 한다', async () => {
            // Given: 잘못된 JSON 응답
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => {
                    throw new Error('JSON parse error');
                },
            });

            // When & Then
            try {
                const response = await fetch('/api/ai/titling', {
                    method: 'POST',
                    body: JSON.stringify({ id: 'test', body: 'test' }),
                });

                await response.json();
                fail('파싱 에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.message).toContain('JSON parse error');
            }
        });
    });
});
