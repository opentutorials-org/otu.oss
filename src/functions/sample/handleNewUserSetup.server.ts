import { SupabaseClient } from '@supabase/supabase-js';
import { addUsageRecordIfNotExists } from '@/functions/usage/addUsageRecordIfNotExists';
import { seedSamplePageIfNeeded } from '@/functions/sample/seedSamplePageIfNeeded.server';
import { authLogger } from '@/debug/auth';

/**
 * 신규 사용자 초기 설정을 처리합니다.
 *
 * 이 함수는 모든 인증 경로(OAuth, 이메일, 모바일)에서 공통으로 사용됩니다.
 *
 * 수행 작업:
 * 1. usage 레코드 확인 및 생성 (신규 사용자 판별)
 * 2. 신규 사용자인 경우 샘플 페이지 생성
 *
 * @param userId 사용자 ID
 * @param supabase Supabase 클라이언트
 * @param source 호출 경로 (로깅용) - 'oauth', 'email', 'native-bridge' 등
 */
export async function handleNewUserSetup(
    userId: string,
    supabase: SupabaseClient,
    source: string
): Promise<void> {
    try {
        // 1. usage 레코드 확인 (신규 사용자인지 판별)
        const isNewUser = await addUsageRecordIfNotExists(supabase);

        // 2. 신규 사용자라면 샘플 페이지 생성
        if (isNewUser) {
            authLogger(`신규 사용자 확인 (${source}), 샘플 페이지 생성 시작`, userId);
            await seedSamplePageIfNeeded(userId, supabase);
        } else {
            authLogger(`기존 사용자 로그인 (${source})`, userId);
        }
    } catch (error) {
        // 샘플 페이지 생성 실패는 사용자 경험에 치명적이지 않으므로 로깅만 하고 에러를 던지지 않음
        authLogger(`신규 사용자 설정 중 에러 발생 (${source})`, { userId, error });
    }
}
