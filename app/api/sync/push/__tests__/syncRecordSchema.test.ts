/** @jest-environment node */
/**
 * syncRecordSchema 검증 테스트
 * Issue #135: PR #128 후속 - Zod 스키마 검증 테스트 커버리지 추가
 *
 * 테스트 대상:
 * - syncRecordSchema: z.any().refine()로 최소 필수 필드(id: string, updated_at: number) 검증
 * - syncPushBodySchema를 통해 간접 테스트 (POST 함수 호출)
 *
 * 테스트 환경:
 * - NODE_ENV=test + TEST_USER_ID 설정 시 인증 우회
 * - 실제 Supabase 연결 없이 검증 로직만 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('syncRecordSchema 검증', () => {
    const TEST_USER_ID = 'test-user-validation-' + Date.now();

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        process.env.TEST_USER_ID = TEST_USER_ID;
        // Supabase 연결을 우회하기 위해 VERCEL_ENV를 설정하지 않음
    });

    afterAll(() => {
        delete process.env.TEST_USER_ID;
    });

    describe('유효한 레코드', () => {
        it('id(string)와 updated_at(number)이 있는 객체는 통과해야 한다', async () => {
            const { POST } = await import('../route');

            const validBody = {
                page: {
                    created: [
                        {
                            id: 'valid-page-id',
                            updated_at: 1234567890,
                            title: 'Test Page',
                            body: 'Test Content',
                            is_public: false,
                            img_url: null,
                            length: 12,
                            type: 'text',
                            folder_id: null,
                            created_at: 1234567890,
                            last_viewed_at: 1234567890,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validBody),
            });

            const res = await POST(req);

            // 400 에러가 아니어야 함 (검증 통과)
            expect(res.status).not.toBe(400);

            // 에러 응답이 아님을 확인 (검증 통과)
            const responseText = await res.text();
            if (res.status === 400) {
                console.log('Unexpected 400 response:', responseText);
            }
        });
    });

    describe('잘못된 레코드 - id 필드', () => {
        it('id가 누락된 경우 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [
                        {
                            // id 누락
                            updated_at: 1234567890,
                            title: 'Test',
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });

        it('id가 number인 경우 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [
                        {
                            id: 12345, // number (invalid)
                            updated_at: 1234567890,
                            title: 'Test',
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });
    });

    describe('잘못된 레코드 - updated_at 필드', () => {
        it('updated_at이 누락된 경우 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [
                        {
                            id: 'test-id',
                            // updated_at 누락
                            title: 'Test',
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });

        it('updated_at이 string인 경우 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [
                        {
                            id: 'test-id',
                            updated_at: '1234567890', // string (invalid)
                            title: 'Test',
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });
    });

    describe('잘못된 레코드 - 비객체 타입', () => {
        it('레코드가 null인 경우 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [null], // null
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });

        it('레코드가 배열인 경우 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [['nested', 'array']], // array
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });

        it('레코드가 string인 경우 400 에러를 반환해야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: ['invalid-string'], // string
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });
    });

    describe('folder 및 alarm 엔티티 검증', () => {
        it('folder 레코드도 동일한 검증 규칙을 따라야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [],
                    updated: [],
                    deleted: [],
                },
                folder: {
                    created: [
                        {
                            id: 123, // number (invalid)
                            updated_at: 1234567890,
                            name: 'Test Folder',
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });

        it('alarm 레코드도 동일한 검증 규칙을 따라야 한다', async () => {
            const { POST } = await import('../route');

            const invalidBody = {
                page: {
                    created: [],
                    updated: [],
                    deleted: [],
                },
                alarm: {
                    created: [
                        {
                            id: 'test-alarm-id',
                            // updated_at 누락
                            page_id: 'test-page-id',
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
            };

            const url = 'http://localhost/api/sync/push?last_pulled_at=0';
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(400);

            const responseJson = await res.json();
            expect(responseJson.error).toBe('Invalid request body');
        });
    });
});
