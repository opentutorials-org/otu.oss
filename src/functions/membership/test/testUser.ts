import { pool } from '@/lib/database/connection';
import { TEST_USER_ID } from '../../constants';
import { testLogger } from '@/debug/test';

export async function createTestUser() {
    testLogger('테스트 유저 생성 - createTestUser', { TEST_USER_ID });
    const client = await pool.connect();
    await client.query(`INSERT INTO auth.users (id) VALUES ($1)`, [TEST_USER_ID]);
    await client.release();
}

export async function deleteTestUser() {
    testLogger('테스트 유저 삭제 - deleteTestUser', { TEST_USER_ID });
    const client = await pool.connect();
    await client.query('DELETE FROM auth.users WHERE id = $1', [TEST_USER_ID]);
    await client.release();
}
