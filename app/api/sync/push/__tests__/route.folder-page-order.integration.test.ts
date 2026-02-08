/** @jest-environment node */

import { createSuperClient } from '@/supabase/utils/super';
import { testLogger } from '@/debug/test';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// 통합 테스트는 실제 Supabase를 사용합니다. 환경변수 필요:
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

const skipDatabaseTests = process.env.SKIP_DATABASE_TESTS === 'true';

describe('Sync Push Route Integration - 폴더/페이지 동시 생성', () => {
    if (skipDatabaseTests) {
        test.skip('데이터베이스 통합 테스트 건너뛰기', () => {});
        return;
    }

    const TEST_RUN_ID = Date.now().toString();
    const TEST_USER_EMAIL = `push-int-${TEST_RUN_ID}@test.com`;
    const TEST_USER_PASSWORD = 'test-password-123';
    let TEST_USER_ID: string | null = null;

    const superClient = createSuperClient();

    beforeAll(async () => {
        // 테스트 사용자 생성 및 인증 클라이언트 준비
        const { data, error } = await superClient.auth.admin.createUser({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
            email_confirm: true,
        });
        if (error) throw new Error(`테스트 사용자 생성 실패: ${error.message}`);
        TEST_USER_ID = data.user?.id ?? null;
        if (!TEST_USER_ID) throw new Error('테스트 사용자 ID를 가져오지 못했습니다.');

        process.env.TEST_USER_ID = TEST_USER_ID;
    });

    afterAll(async () => {
        // 테스트 데이터 정리: 사용자 소프트 삭제
        if (TEST_USER_ID) {
            try {
                await superClient.auth.admin.deleteUser(TEST_USER_ID, true);
            } catch (e) {
                testLogger('테스트 사용자 삭제 중 오류:', e);
            }
            process.env.TEST_USER_ID = undefined;
        }
    });

    test('새 폴더와 해당 폴더를 참조하는 페이지를 동시에 push하면 성공하고 실제 DB에 생성된다', async () => {
        if (!TEST_USER_ID) throw new Error('TEST_USER_ID is not set');

        const { POST } = await import('../route');

        const folderId = `550e8400-e29b-41d4-a716-${(Date.now() + 1).toString().slice(-12).padStart(12, '0')}`;
        const pageId = `550e8400-e29b-41d4-a716-${(Date.now() + 2).toString().slice(-12).padStart(12, '0')}`;
        const alarmId = `550e8400-e29b-41d4-a716-${(Date.now() + 3).toString().slice(-12).padStart(12, '0')}`;
        const now = Date.now();

        const body = {
            folder: {
                created: [
                    {
                        id: folderId,
                        _status: 'created',
                        _changed: '',
                        name: 'Folder INT',
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
            page: {
                type: 'text',
                created: [
                    {
                        id: pageId,
                        _status: 'created',
                        _changed: '',
                        title: 'Page INT',
                        body: 'content',
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
                        folder_id: folderId,
                    },
                ],
                updated: [],
                deleted: [],
            },
            alarm: {
                created: [
                    // alarm(추가) -> page -> folder 순으로 의존성을 검증하기 위해, pageId를 참조하는 알람을 먼저 생성하도록 본문에 포함합니다
                    {
                        id: alarmId,
                        _status: 'created',
                        _changed: '',
                        next_alarm_time: now + 60_000,
                        page_id: pageId,
                        last_notification_id: null,
                        sent_count: 1,
                        created_at: now,
                        updated_at: now,
                        user_id: TEST_USER_ID,
                    },
                ],
                updated: [],
                deleted: [],
            },
        } as any;

        const url = `http://localhost/api/sync/push?last_pulled_at=${now + 1000}`;
        const req = new Request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const res = await POST(req);
        const text = await res.text();
        testLogger('push 응답', { status: res.status, body: text });

        expect(res.status).toBe(200);
        const parsed = JSON.parse(text);
        expect(parsed.success).toBe(true);

        // 실제 DB 조회로 생성 확인 (service role)
        const { data: folderRows, error: folderErr } = await superClient
            .from('folder')
            .select('id, user_id')
            .eq('id', folderId)
            .eq('user_id', TEST_USER_ID);
        expect(folderErr).toBeNull();
        expect(folderRows && folderRows.length).toBe(1);

        const { data: pageRows, error: pageErr } = await superClient
            .from('page')
            .select('id, user_id, folder_id')
            .eq('id', pageId)
            .eq('user_id', TEST_USER_ID)
            .eq('folder_id', folderId);
        expect(pageErr).toBeNull();
        expect(pageRows && pageRows.length).toBe(1);

        // 알람도 정상 생성되었는지 확인 (service role)
        const { data: alarmRows, error: alarmErr } = await superClient
            .from('alarm')
            .select('id, user_id, page_id')
            .eq('id', alarmId)
            .eq('user_id', TEST_USER_ID)
            .eq('page_id', pageId);
        expect(alarmErr).toBeNull();
        expect(alarmRows && alarmRows.length).toBe(1);

        // 정리: 알람 없음, 페이지 -> 폴더 순으로 삭제, 삭제 추적도 정리
        await superClient.from('alarm').delete().eq('page_id', pageId).eq('user_id', TEST_USER_ID);
        await superClient.from('page').delete().eq('id', pageId).eq('user_id', TEST_USER_ID);
        await superClient.from('folder').delete().eq('id', folderId).eq('user_id', TEST_USER_ID);
        await superClient.from('page_deleted').delete().eq('id', pageId);
        await superClient.from('folder_deleted').delete().eq('id', folderId);
    });
});
