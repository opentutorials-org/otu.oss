import { createClient } from '@/supabase/utils/client';
import throttle from 'lodash/throttle';

/**
 * 실제 슈퍼유저 체크 함수 (throttle 적용 전)
 */
async function _checkIsSuperuser(): Promise<boolean> {
    try {
        const supabase = createClient();

        // 현재 로그인한 사용자 정보 가져오기
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.user?.id) {
            return false;
        }

        const userId = sessionData.session.user.id;

        // superuser 테이블에서 현재 사용자 ID로 조회
        const { data, error } = await supabase
            .from('superuser')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('superuser 체크 중 오류 발생:', error);
            return false;
        }

        // 데이터가 존재하면 superuser
        return data !== null;
    } catch (error) {
        console.error('superuser 체크 중 예외 발생:', error);
        return false;
    }
}

/**
 * 현재 로그인한 사용자가 superuser인지 확인하는 함수 (throttle 적용)
 * @returns Promise<boolean> - superuser인 경우 true, 아닌 경우 false
 */
export const checkIsSuperuser = throttle(_checkIsSuperuser, 10 * 60 * 1000, {
    trailing: false, // 마지막 호출은 무시 (leading만 실행)
});

/**
 * superuser 체크 throttle을 무효화하는 함수
 */
export function invalidateSuperuserCache(): void {
    checkIsSuperuser.flush();
}
