import { pool } from '@/lib/database/connection';
import { TEST_USER_ID, TEST_CONSENT_VERSION } from '../../constants';
import { testLogger } from '@/debug/test';

export async function createTestUserInfo({
    pay_type = 'free',
    latest_stat_begin_date = '2021-01-01',
    available_status = 'ACTIVE',
    price = 0,
    usage_limit = 100,
    user_id = TEST_USER_ID,
    marketing_consent_version = TEST_CONSENT_VERSION,
    privacy_policy_consent_version = TEST_CONSENT_VERSION,
    terms_of_service_consent_version = TEST_CONSENT_VERSION,
}: {
    pay_type?: 'free' | 'subscription';
    latest_stat_begin_date?: string;
    available_status?: string;
    price?: number;
    usage_limit?: number;
    user_id?: string;
    marketing_consent_version?: string;
    privacy_policy_consent_version?: string;
    terms_of_service_consent_version?: string;
}) {
    testLogger('초기 데이터 생성 - createTestUserInfo', {
        pay_type,
        latest_stat_begin_date,
        available_status,
        price,
        usage_limit,
        user_id,
        marketing_consent_version,
        privacy_policy_consent_version,
        terms_of_service_consent_version,
    });
    const client = await pool.connect();
    await client.query(
        `
    INSERT INTO user_info (
      pay_type, latest_stat_begin_date, available_status, price, usage_limit, user_id,
      marketing_consent_version, privacy_policy_consent_version, terms_of_service_consent_version
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    )
  `,
        [
            pay_type,
            latest_stat_begin_date,
            available_status,
            price,
            usage_limit,
            user_id,
            marketing_consent_version,
            privacy_policy_consent_version,
            terms_of_service_consent_version,
        ]
    );
    client.release();
}

export async function deleteTestUserInfo() {
    const client = await pool.connect();
    await client.query('DELETE FROM user_info WHERE user_id = $1', [TEST_USER_ID]);
    client.release();
}
