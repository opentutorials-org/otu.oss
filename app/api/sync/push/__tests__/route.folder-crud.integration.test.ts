/** @jest-environment node */
/**
 * 폴더 CRUD 통합 테스트
 * 이슈 #77: 폴더 생성, 수정, 삭제 및 페이지 연결 테스트
 *
 * 실제 Supabase를 사용하며, 환경변수 필요:
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createSuperClient } from '@/supabase/utils/super';
import { testLogger } from '@/debug/test';

const skipDatabaseTests = process.env.SKIP_DATABASE_TESTS === 'true';

describe('Sync Push Route Integration - 폴더 CRUD', () => {
    if (skipDatabaseTests) {
        test.skip('데이터베이스 통합 테스트 건너뛰기', () => {});
        return;
    }

    const TEST_RUN_ID = Date.now().toString();
    const TEST_USER_EMAIL = `folder-crud-${TEST_RUN_ID}@test.com`;
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

    describe('폴더 생성', () => {
        test('새 폴더를 push하면 DB에 생성된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 1).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            const body = {
                folder: {
                    created: [
                        {
                            id: folderId,
                            _status: 'created',
                            _changed: '',
                            name: '테스트 폴더',
                            description: '테스트 폴더 설명',
                            thumbnail_url: '',
                            page_count: 0,
                            created_at: now,
                            updated_at: now,
                            last_page_added_at: null,
                            user_id: TEST_USER_ID,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
                page: { created: [], updated: [], deleted: [] },
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

            const { data: folderRows } = await superClient
                .from('folder')
                .select('id, name, description, user_id')
                .eq('id', folderId);

            expect(folderRows?.length).toBe(1);
            expect(folderRows?.[0].name).toBe('테스트 폴더');
            expect(folderRows?.[0].description).toBe('테스트 폴더 설명');

            // 정리
            await superClient.from('folder').delete().eq('id', folderId);
            await superClient.from('folder_deleted').delete().eq('id', folderId);
        });

        test('빈 폴더명으로 생성 시도 시 빈 문자열로 저장된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 2).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            const body = {
                folder: {
                    created: [
                        {
                            id: folderId,
                            _status: 'created',
                            _changed: '',
                            name: '',
                            description: '',
                            thumbnail_url: '',
                            page_count: 0,
                            created_at: now,
                            updated_at: now,
                            last_page_added_at: null,
                            user_id: TEST_USER_ID,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
                page: { created: [], updated: [], deleted: [] },
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

            const { data: folderRows } = await superClient
                .from('folder')
                .select('name')
                .eq('id', folderId);

            expect(folderRows?.length).toBe(1);
            expect(folderRows?.[0].name).toBe('');

            // 정리
            await superClient.from('folder').delete().eq('id', folderId);
            await superClient.from('folder_deleted').delete().eq('id', folderId);
        });
    });

    describe('폴더 수정', () => {
        test('폴더 이름과 설명을 수정할 수 있다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 3).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 먼저 폴더 생성
            await superClient.from('folder').insert({
                id: folderId,
                name: '원본 폴더명',
                description: '원본 설명',
                thumbnail_url: null,
                page_count: 0,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                last_page_added_at: null,
                user_id: TEST_USER_ID,
            });

            // 폴더 수정
            const updateBody = {
                folder: {
                    created: [],
                    updated: [
                        {
                            id: folderId,
                            _status: 'updated',
                            _changed: 'name,description',
                            name: '수정된 폴더명',
                            description: '수정된 설명',
                            thumbnail_url: '',
                            page_count: 0,
                            created_at: now,
                            updated_at: now + 1000,
                            last_page_added_at: null,
                            user_id: TEST_USER_ID,
                        },
                    ],
                    deleted: [],
                },
                page: { created: [], updated: [], deleted: [] },
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

            const { data: folderRows } = await superClient
                .from('folder')
                .select('name, description')
                .eq('id', folderId);

            expect(folderRows?.[0].name).toBe('수정된 폴더명');
            expect(folderRows?.[0].description).toBe('수정된 설명');

            // 정리
            await superClient.from('folder').delete().eq('id', folderId);
            await superClient.from('folder_deleted').delete().eq('id', folderId);
        });
    });

    describe('폴더 삭제', () => {
        test('폴더를 삭제하면 folder_deleted 테이블에 기록된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 4).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 먼저 폴더 생성
            await superClient.from('folder').insert({
                id: folderId,
                name: '삭제할 폴더',
                description: '',
                thumbnail_url: null,
                page_count: 0,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                last_page_added_at: null,
                user_id: TEST_USER_ID,
            });

            // 폴더 삭제
            const deleteBody = {
                folder: {
                    created: [],
                    updated: [],
                    deleted: [folderId],
                },
                page: { created: [], updated: [], deleted: [] },
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
            const { data: folderRows } = await superClient
                .from('folder')
                .select('id')
                .eq('id', folderId);

            expect(folderRows?.length).toBe(0);

            // folder_deleted 테이블에 기록 확인
            const { data: deletedRows } = await superClient
                .from('folder_deleted')
                .select('id')
                .eq('id', folderId);

            expect(deletedRows?.length).toBeGreaterThan(0);

            // 정리
            await superClient.from('folder_deleted').delete().eq('id', folderId);
        });
    });

    describe('폴더-페이지 관계', () => {
        test('페이지를 폴더에 추가하면 folder_id가 설정된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 5).toString().slice(-12).padStart(12, '0')}`;
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 6).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            const body = {
                folder: {
                    created: [
                        {
                            id: folderId,
                            _status: 'created',
                            _changed: '',
                            name: '페이지용 폴더',
                            description: '',
                            thumbnail_url: '',
                            page_count: 1,
                            created_at: now,
                            updated_at: now,
                            last_page_added_at: null,
                            user_id: TEST_USER_ID,
                        },
                    ],
                    updated: [],
                    deleted: [],
                },
                page: {
                    type: 'text',
                    created: [
                        {
                            id: pageId,
                            _status: 'created',
                            _changed: '',
                            title: '폴더 내 페이지',
                            body: 'content',
                            is_public: false,
                            child_count: null,
                            parent_count: null,
                            last_viewed_at: null,
                            img_url: '',
                            length: 7,
                            created_at: now,
                            updated_at: now,
                            user_id: TEST_USER_ID,
                            type: 'text',
                            folder_id: folderId,
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
                .select('id, folder_id')
                .eq('id', pageId);

            expect(pageRows?.[0].folder_id).toBe(folderId);

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('folder').delete().eq('id', folderId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
            await superClient.from('folder_deleted').delete().eq('id', folderId);
        });

        test('페이지를 폴더에서 제거하면 folder_id가 null이 된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const { POST } = await import('../route');
            const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 7).toString().slice(-12).padStart(12, '0')}`;
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 8).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 폴더와 페이지 생성
            await superClient.from('folder').insert({
                id: folderId,
                name: '페이지 제거 테스트 폴더',
                description: '',
                thumbnail_url: null,
                page_count: 1,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                last_page_added_at: null,
                user_id: TEST_USER_ID,
            });

            await superClient.from('page').insert({
                id: pageId,
                title: '이동할 페이지',
                body: 'content',
                is_public: false,
                img_url: null,
                length: 7,
                type: 'text',
                folder_id: folderId,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                user_id: TEST_USER_ID,
            });

            // 페이지의 folder_id를 null로 업데이트
            const updateBody = {
                folder: { created: [], updated: [], deleted: [] },
                page: {
                    type: 'text',
                    created: [],
                    updated: [
                        {
                            id: pageId,
                            _status: 'updated',
                            _changed: 'folder_id',
                            title: '이동할 페이지',
                            body: 'content',
                            is_public: false,
                            child_count: null,
                            parent_count: null,
                            last_viewed_at: null,
                            img_url: '',
                            length: 7,
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
                .select('folder_id')
                .eq('id', pageId);

            expect(pageRows?.[0].folder_id).toBeNull();

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('folder').delete().eq('id', folderId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
            await superClient.from('folder_deleted').delete().eq('id', folderId);
        });

        test('폴더 삭제 시 폴더 내 페이지의 folder_id가 null이 된다', async () => {
            if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

            const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 9).toString().slice(-12).padStart(12, '0')}`;
            const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 10).toString().slice(-12).padStart(12, '0')}`;
            const now = Date.now();

            // 폴더와 페이지 생성
            await superClient.from('folder').insert({
                id: folderId,
                name: '삭제될 폴더',
                description: '',
                thumbnail_url: null,
                page_count: 1,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                last_page_added_at: null,
                user_id: TEST_USER_ID,
            });

            await superClient.from('page').insert({
                id: pageId,
                title: '폴더 삭제 테스트 페이지',
                body: 'content',
                is_public: false,
                img_url: null,
                length: 7,
                type: 'text',
                folder_id: folderId,
                created_at: new Date(now).toISOString(),
                updated_at: new Date(now).toISOString(),
                user_id: TEST_USER_ID,
            });

            // 폴더 삭제 (DB 트리거가 페이지의 folder_id를 null로 설정해야 함)
            await superClient.from('folder').delete().eq('id', folderId);

            // 페이지의 folder_id 확인
            const { data: pageRows } = await superClient
                .from('page')
                .select('folder_id')
                .eq('id', pageId);

            expect(pageRows?.[0].folder_id).toBeNull();

            // 정리
            await superClient.from('page').delete().eq('id', pageId);
            await superClient.from('page_deleted').delete().eq('id', pageId);
            await superClient.from('folder_deleted').delete().eq('id', folderId);
        });
    });
});
