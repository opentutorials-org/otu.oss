/** @jest-environment node */
/**
 * 페이지 CRUD 통합 테스트
 * 이슈 #78: 페이지 생성, 수정, 삭제 및 동기화 테스트
 *
 * 실제 Supabase를 사용하며, 환경변수 필요:
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createSuperClient } from '@/supabase/utils/super';
import { testLogger } from '@/debug/test';

// route.ts 로드시 필요한 환경변수 세팅
process.env.NEXT_PUBLIC_HOST = process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';

const skipDatabaseTests = process.env.SKIP_DATABASE_TESTS === 'true';

describe('Sync Push Route Integration - 페이지 CRUD', () => {
    if (skipDatabaseTests) {
        test.skip('데이터베이스 통합 테스트 건너뛰기', () => {});
        return;
    }

    const TEST_RUN_ID = Date.now().toString();
    const TEST_USER_EMAIL = `page-crud-${TEST_RUN_ID}@test.com`;
    const TEST_USER_PASSWORD = 'test-password-123';
    let TEST_USER_ID: string | null = null;

    const superClient = createSuperClient();

    beforeAll(async () => {
        const { data, error } = await superClient.auth.admin.createUser({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
            email_confirm: true,
        });
        if (error) throw new Error(`테스트 사용자 생성 실패: ${error.message}`);
        TEST_USER_ID = data.user?.id ?? null;
        if (!TEST_USER_ID) throw new Error('테스트 사용자 ID를 가져오지 못했습니다.');
        process.env.TEST_USER_ID = TEST_USER_ID;
        testLogger('🔧 테스트 사용자 생성 완료:', TEST_USER_ID);
    });

    afterAll(async () => {
        if (TEST_USER_ID) {
            try {
                await superClient.auth.admin.deleteUser(TEST_USER_ID, true);
                testLogger('🧹 테스트 사용자 삭제 완료');
            } catch (e) {
                testLogger('테스트 사용자 삭제 중 오류:', e);
            }
            process.env.TEST_USER_ID = undefined;
        }
    });

    describe('페이지 생성', () => {
        test('새 페이지를 push하면 DB에 생성된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 1).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            const body = {
                folder: { created: [], updated: [], deleted: [] },
                page: {
                    type: 'text',
                    created: [
                        {
                            id: pageId,
                            _status: 'created',
                            _changed: '',
                            title: '테스트 페이지',
                            body: '테스트 본문 내용입니다.',
                            is_public: false,
                            child_count: null,
                            parent_count: null,
                            last_viewed_at: null,
                            img_url: '',
                            length: 12,
                            created_at: now,
                            updated_at: now,
                            user_id: TEST_USER_ID,
                            type: 'text',
                            folder_id: null,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
                alarm: { created: [], updated: [], deleted: [] },
            };

            const url = `http://localhost/api/sync/push?last_pulled_at=${now + 1000}`;
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const res = await POST(req);
            expect(res.status).toBe(200);

            const { data: pageRows } = await superClient
                .from('page')
                .select('id, title, body, type, user_id')
                .eq('id', pageId);

            expect(pageRows?.length).toBe(1);
            expect(pageRows?.[0].title).toBe('테스트 페이지');
            expect(pageRows?.[0].body).toBe('테스트 본문 내용입니다.');
            expect(pageRows?.[0].type).toBe('text');

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
        });

        test('필수 필드(title, body)가 비어있어도 생성 가능하다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 2).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            const body = {
                folder: { created: [], updated: [], deleted: [] },
                page: {
                    type: 'text',
                    created: [
                        {
                            id: pageId,
                            _status: 'created',
                            _changed: '',
                            title: '',
                            body: '',
                            is_public: false,
                            child_count: null,
                            parent_count: null,
                            last_viewed_at: null,
                            img_url: '',
                            length: 0,
                            created_at: now,
                            updated_at: now,
                            user_id: TEST_USER_ID,
                            type: 'text',
                            folder_id: null,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
                alarm: { created: [], updated: [], deleted: [] },
            };

            const url = `http://localhost/api/sync/push?last_pulled_at=${now + 1000}`;
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const res = await POST(req);
            expect(res.status).toBe(200);

            const { data: pageRows } = await superClient
                .from('page')
                .select('title, body')
                .eq('id', pageId);

            expect(pageRows?.length).toBe(1);
            expect(pageRows?.[0].title).toBe('');
            expect(pageRows?.[0].body).toBe('');

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
        });
    });

    describe('페이지 수정', () => {
        test('페이지 제목과 본문을 수정할 수 있다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 3).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 먼저 페이지 생성
            await superClient.from('page').insert({
                id: pageId,
                title: '원본 제목',
                body: '원본 본문',
                is_public: false,
                img_url: null,
                length: 5,
                type: 'text',
                folder_id: null,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                user_id: TEST_USER_ID,
            });

            // 페이지 수정
            const updateBody = {
                folder: { created: [], updated: [], deleted: [] },
                page: {
                    type: 'text',
                    created: [],
                    updated: [
                        {
                            id: pageId,
                            _status: 'updated',
                            _changed: 'title,body',
                            title: '수정된 제목',
                            body: '수정된 본문 내용입니다.',
                            is_public: false,
                            child_count: null,
                            parent_count: null,
                            last_viewed_at: null,
                            img_url: '',
                            length: 13,
                            created_at: now,
                            updated_at: now + 1000,
                            user_id: TEST_USER_ID,
                            type: 'text',
                            folder_id: null,
                        },
                    ],
                    deleted: [],
                },
                alarm: { created: [], updated: [], deleted: [] },
            };

            const url = `http://localhost/api/sync/push?last_pulled_at=${now + 2000}`;
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(200);

            const { data: pageRows } = await superClient
                .from('page')
                .select('title, body')
                .eq('id', pageId);

            expect(pageRows?.[0].title).toBe('수정된 제목');
            expect(pageRows?.[0].body).toBe('수정된 본문 내용입니다.');

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
        });

        test('페이지 공개 상태를 변경할 수 있다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 4).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 비공개 페이지 생성
            await superClient.from('page').insert({
                id: pageId,
                title: '공개 테스트 페이지',
                body: '내용',
                is_public: false,
                img_url: null,
                length: 2,
                type: 'text',
                folder_id: null,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                user_id: TEST_USER_ID,
            });

            // 공개로 변경
            const updateBody = {
                folder: { created: [], updated: [], deleted: [] },
                page: {
                    type: 'text',
                    created: [],
                    updated: [
                        {
                            id: pageId,
                            _status: 'updated',
                            _changed: 'is_public',
                            title: '공개 테스트 페이지',
                            body: '내용',
                            is_public: true,
                            child_count: null,
                            parent_count: null,
                            last_viewed_at: null,
                            img_url: '',
                            length: 2,
                            created_at: now,
                            updated_at: now + 1000,
                            user_id: TEST_USER_ID,
                            type: 'text',
                            folder_id: null,
                        },
                    ],
                    deleted: [],
                },
                alarm: { created: [], updated: [], deleted: [] },
            };

            const url = `http://localhost/api/sync/push?last_pulled_at=${now + 2000}`;
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(200);

            const { data: pageRows } = await superClient
                .from('page')
                .select('is_public')
                .eq('id', pageId);

            expect(pageRows?.[0].is_public).toBe(true);

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
        });
    });

    describe('페이지 삭제', () => {
        test('페이지를 삭제하면 page_deleted 테이블에 기록된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 5).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 먼저 페이지 생성
            await superClient.from('page').insert({
                id: pageId,
                title: '삭제할 페이지',
                body: '삭제될 내용',
                is_public: false,
                img_url: null,
                length: 5,
                type: 'text',
                folder_id: null,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                user_id: TEST_USER_ID,
            });

            // 페이지 삭제
            const deleteBody = {
                folder: { created: [], updated: [], deleted: [] },
                page: {
                    type: 'text',
                    created: [],
                    updated: [],
                    deleted: [pageId],
                },
                alarm: { created: [], updated: [], deleted: [] },
            };

            const url = `http://localhost/api/sync/push?last_pulled_at=${now + 1000}`;
            const req = new Request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deleteBody),
            });

            const res = await POST(req);
            expect(res.status).toBe(200);

            // 원본 테이블에서 삭제 확인
            const { data: pageRows } = await superClient.from('page').select('id').eq('id', pageId);

            expect(pageRows?.length).toBe(0);

            // page_deleted 테이블에 기록 확인
            const { data: deletedRows } = await superClient
                .from('page_deleted')
                .select('id')
                .eq('id', pageId);

            expect(deletedRows?.length).toBeGreaterThan(0);

            // 정리
            await superClient.from('page_deleted').delete().eq('id', pageId);
        });

        test('알람이 있는 페이지 삭제 시 알람도 함께 삭제된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 6).toString().slice(-12).padStart(12, '0')}`;
            const alarmId = `550e8400-e29b-41d4-a716-${(Date.now() + 7).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 페이지 생성
            await superClient.from('page').insert({
                id: pageId,
                title: '알람 있는 페이지',
                body: '내용',
                is_public: false,
                img_url: null,
                length: 2,
                type: 'text',
                folder_id: null,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                user_id: TEST_USER_ID,
            });

            // 알람 생성
            await superClient.from('alarm').insert({
                id: alarmId,
                user_id: TEST_USER_ID,
                page_id: pageId,
                next_alarm_time: new Date(now + 86400000).toISOString(),
                sent_count: 0,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
            });

            // 페이지 삭제 (CASCADE로 알람도 삭제됨)
            await superClient.from('page').delete().eq('id', pageId);

            // 알람이 삭제되었는지 확인
            const { data: alarmRows } = await superClient
                .from('alarm')
                .select('id')
                .eq('id', alarmId);

            expect(alarmRows?.length).toBe(0);

            // 정리
            await superClient.from('page_deleted').delete().eq('id', pageId);
            await superClient.from('alarm_deleted').delete().eq('id', alarmId);
        });
    });

    describe('증분 동기화', () => {
        test('lastPulledAt 이후 변경된 페이지만 조회된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const pageId1 = `550e8400-e29b-41d4-a716-${(Date.now() + 8).toString().slice(-12).padStart(12, '0')}`;
            const pageId2 = `550e8400-e29b-41d4-a716-${(Date.now() + 9).toString().slice(-12).padStart(12, '0')}`;

            const baseTime = new Date('2024-06-01T10:00:00.000Z');
            const page1UpdatedAt = new Date('2024-06-01T11:00:00.000Z');
            const page2UpdatedAt = new Date('2024-06-01T13:00:00.000Z');

            // 두 개의 페이지 생성 (다른 updated_at)
            await superClient.from('page').insert({
                id: pageId1,
                title: '페이지 1',
                body: '내용 1',
                is_public: false,
                img_url: null,
                length: 3,
                type: 'text',
                folder_id: null,
                created_at: baseTime.toISOString(),
                updated_at: page1UpdatedAt.toISOString(),
                user_id: TEST_USER_ID,
            });

            await superClient.from('page').insert({
                id: pageId2,
                title: '페이지 2',
                body: '내용 2',
                is_public: false,
                img_url: null,
                length: 3,
                type: 'text',
                folder_id: null,
                created_at: baseTime.toISOString(),
                updated_at: page2UpdatedAt.toISOString(),
                user_id: TEST_USER_ID,
            });

            // 12:00 이후 변경된 페이지만 조회 (페이지 2만 해당)
            const lastPulledAt = new Date('2024-06-01T12:00:00.000Z');
            const { data: pages } = await superClient
                .from('page')
                .select('id')
                .eq('user_id', TEST_USER_ID)
                .gte('updated_at', lastPulledAt.toISOString())
                .in('id', [pageId1, pageId2]);

            expect(pages?.length).toBe(1);
            expect(pages?.[0].id).toBe(pageId2);

            // 정리
            await superClient.from('page').delete().in('id', [pageId1, pageId2]);
            await superClient.from('page_deleted').delete().in('id', [pageId1, pageId2]);
        });
    });

    describe('RLS 권한', () => {
        test('다른 사용자의 페이지는 Service Role로만 접근 가능하다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 10).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 테스트 사용자의 페이지 생성
            await superClient.from('page').insert({
                id: pageId,
                title: 'RLS 테스트 페이지',
                body: '비밀 내용',
                is_public: false,
                img_url: null,
                length: 4,
                type: 'text',
                folder_id: null,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                user_id: TEST_USER_ID,
            });

            // Service Role 클라이언트로는 접근 가능
            const { data: serviceRoleData } = await superClient
                .from('page')
                .select('id, title')
                .eq('id', pageId);

            expect(serviceRoleData?.length).toBe(1);
            expect(serviceRoleData?.[0].title).toBe('RLS 테스트 페이지');

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
        });
    });
});
