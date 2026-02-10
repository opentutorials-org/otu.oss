/** @jest-environment node */
/**
 * AI API 입력 검증 테스트
 * Issue #135: PR #128 후속 - AI API 입력 검증 테스트 커버리지 추가
 *
 * 테스트 대상:
 * - askLLM: message 필드 검증
 * - similaritySearch: inputMessage 필드 검증
 * - titling: body 필드 검증
 *
 * 검증 규칙:
 * - 잘못된 JSON → 400 (INVALID_JSON)
 * - 필수 필드 누락 → 400 (EMPTY_MESSAGE/EMPTY_BODY)
 */

import { describe, it, expect, jest, beforeEach, beforeAll, afterAll } from '@jest/globals';

// next/headers cookies 모킹
jest.mock('next/headers', () => ({
    cookies: jest.fn(() => ({
        getAll: jest.fn<any>().mockResolvedValue([]),
        set: jest.fn(),
    })),
}));

// Supabase 클라이언트 모킹 (인증 성공 시나리오)
jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(() => ({
        auth: {
            getUser: jest.fn<any>().mockResolvedValue({
                data: { user: { id: 'test-user-id' } },
                error: null,
            }),
        },
    })),
}));

// AI SDK + Langfuse 로드를 차단하여 CI 워커 OOM 방지 (#143)
// 이 테스트는 입력 검증 로직만 검증하므로 실제 AI SDK 동작은 불필요
jest.mock('langfuse', () => ({
    Langfuse: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
    createOpenAI: jest.fn(() => jest.fn()),
}));

jest.mock('@ai-sdk/gateway', () => ({
    gateway: jest.fn(() => jest.fn()),
}));

jest.mock('ai', () => ({
    streamText: jest.fn(),
    generateObject: jest.fn(),
}));

describe('AI API 입력 검증', () => {
    beforeAll(() => {
        // AI 기능 활성화 (OPENAI_API_KEY 필요)
        process.env.OPENAI_API_KEY = 'test-key';
    });

    afterAll(() => {
        delete process.env.OPENAI_API_KEY;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('askLLM API', () => {
        it('잘못된 JSON 요청 시 400 (INVALID_JSON) 에러를 반환해야 한다', async () => {
            const { POST } = await import('../askLLM/openai/route');

            const req = new Request('http://localhost/api/ai/askLLM/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: 'invalid-json',
            });

            const res = await POST(req as any);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('INVALID_JSON');
            expect(responseJson.message).toContain('잘못된 요청 형식');
        });

        it('message 필드 누락 시 400 (EMPTY_MESSAGE) 에러를 반환해야 한다', async () => {
            const { POST } = await import('../askLLM/openai/route');

            const invalidBody = {
                // message 필드 누락
                references: [],
                history: [],
            };

            const req = new Request('http://localhost/api/ai/askLLM/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req as any);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('EMPTY_MESSAGE');
            expect(responseJson.message).toContain('메시지를 입력해주세요');
        });

        it('message가 빈 문자열인 경우에도 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../askLLM/openai/route');

            const invalidBody = {
                message: '', // 빈 문자열
                references: [],
                history: [],
            };

            const req = new Request('http://localhost/api/ai/askLLM/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req as any);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('EMPTY_MESSAGE');
        });
    });

    describe('similaritySearch API', () => {
        it('잘못된 JSON 요청 시 400 (INVALID_JSON) 에러를 반환해야 한다', async () => {
            const { POST } = await import('../similaritySearch/route');

            const req = new Request('http://localhost/api/ai/similaritySearch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: 'invalid-json',
            });

            const res = await POST(req);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('INVALID_JSON');
            expect(responseJson.message).toContain('잘못된 요청 형식');
        });

        it('inputMessage 필드 누락 시 400 (EMPTY_MESSAGE) 에러를 반환해야 한다', async () => {
            const { POST } = await import('../similaritySearch/route');

            const invalidBody = {
                // inputMessage 필드 누락
                page_id: 'test-page-id',
                count: 3,
            };

            const req = new Request('http://localhost/api/ai/similaritySearch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('EMPTY_MESSAGE');
            expect(responseJson.message).toContain('검색할 메시지가 필요합니다');
        });

        it('inputMessage가 빈 문자열인 경우에도 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../similaritySearch/route');

            const invalidBody = {
                inputMessage: '', // 빈 문자열
                page_id: 'test-page-id',
            };

            const req = new Request('http://localhost/api/ai/similaritySearch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('EMPTY_MESSAGE');
        });
    });

    describe('titling API', () => {
        it('잘못된 JSON 요청 시 400 (INVALID_JSON) 에러를 반환해야 한다', async () => {
            const { POST } = await import('../titling/route');

            const req = new Request('http://localhost/api/ai/titling', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: 'invalid-json',
            });

            const res = await POST(req);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('INVALID_JSON');
            expect(responseJson.message).toContain('잘못된 요청 형식');
        });

        it('body 필드 누락 시 400 (EMPTY_BODY) 에러를 반환해야 한다', async () => {
            const { POST } = await import('../titling/route');

            const invalidBody = {
                // body 필드 누락
                id: 'test-page-id',
            };

            const req = new Request('http://localhost/api/ai/titling', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('EMPTY_BODY');
            expect(responseJson.message).toContain('제목을 생성할 본문이 필요합니다');
        });

        it('body가 빈 문자열인 경우에도 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../titling/route');

            const invalidBody = {
                body: '', // 빈 문자열
                id: 'test-page-id',
            };

            const req = new Request('http://localhost/api/ai/titling', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept-language': 'ko',
                },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res!.status).toBe(400);

            const responseJson = await res!.json();
            expect(responseJson.errorCode).toBe('EMPTY_BODY');
        });
    });

    describe('에러 응답 형식 일관성', () => {
        it('모든 API가 errorCode와 message를 포함한 응답을 반환해야 한다', async () => {
            const apis = [
                {
                    name: 'askLLM',
                    module: await import('../askLLM/openai/route'),
                    url: 'http://localhost/api/ai/askLLM/openai',
                },
                {
                    name: 'similaritySearch',
                    module: await import('../similaritySearch/route'),
                    url: 'http://localhost/api/ai/similaritySearch',
                },
                {
                    name: 'titling',
                    module: await import('../titling/route'),
                    url: 'http://localhost/api/ai/titling',
                },
            ];

            for (const api of apis) {
                const req = new Request(api.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'accept-language': 'ko',
                    },
                    body: 'invalid-json',
                });

                const res = await api.module.POST(req as any);
                const responseJson = await res!.json();

                expect(responseJson).toHaveProperty('errorCode');
                expect(responseJson).toHaveProperty('message');
                expect(responseJson.errorCode).toBe('INVALID_JSON');
            }
        });
    });
});
