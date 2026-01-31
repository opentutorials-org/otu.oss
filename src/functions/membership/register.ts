import { PoolClient } from 'pg';
import { memberRegisterLogger } from '@/debug/member';

/**
 * api_usage_statistic 및 user_info 테이블에 데이터를 삽입하여 시스템에 새로운 사용자를 등록합니다.
 *
 * @param {Object} params - 등록을 위한 매개변수.
 * @param {PoolClient} params.client - 데이터베이스 클라이언트.
 * @param {string} params.user_id - 사용자의 고유 식별자.
 * @param {string|null} [params.marketing_consent_version=null] - 마케팅 동의 버전.
 * @param {string|null} [params.privacy_policy_consent_version=null] - 개인정보 보호정책 동의 버전.
 * @param {string|null} [params.terms_of_service_consent_version=null] - 서비스 약관 동의 버전.
 * @returns {Promise<string>} 등록이 완료되면 "success" 메시지를 반환하는 프로미스.
 * @throws 데이터베이스 작업이 실패하면 에러를 던집니다.
 */
export async function register({
    client,
    user_id,
    marketing_consent_version = null,
    privacy_policy_consent_version = null,
    terms_of_service_consent_version = null,
}: {
    client: PoolClient;
    user_id: string;
    marketing_consent_version?: string | null;
    privacy_policy_consent_version?: string | null;
    terms_of_service_consent_version?: string | null;
}): Promise<string> {
    try {
        const info_query = `
            INSERT INTO user_info (
                available_status, 
                user_id,
                marketing_consent_version,
                privacy_policy_consent_version,
                terms_of_service_consent_version
            ) VALUES ($1, $2, $3, $4, $5)
        `;
        const info_param = [
            'ACTIVE',
            user_id,
            marketing_consent_version,
            privacy_policy_consent_version,
            terms_of_service_consent_version,
        ];
        await client.query(info_query, info_param);
        memberRegisterLogger('user_info 쿼리', info_query, 'info_param:', info_param);

        return 'success';
    } catch (error) {
        memberRegisterLogger('가입을 처리하면서 오류가 발생:', error);
        throw new Error(`Registration failed: ${(error as Error).message}`);
    }
}
