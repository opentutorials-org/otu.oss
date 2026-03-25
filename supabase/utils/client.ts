import { Database } from '@/lib/database/types';
import { createBrowserClient } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseConfig, SUPABASE_NOT_CONFIGURED_MESSAGE } from './config';
// @ts-ignore

let debug = false;
if (typeof window !== 'undefined') {
    debug = localStorage.getItem('debug')?.includes('auth') || false;
}
export function createClient() {
    const config = getSupabaseConfig();
    if (!config) {
        throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
    }

    return createBrowserClient<Database>(config.url, config.anonKey, {
        auth: {
            debug: process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED
                ? process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED === 'true'
                : false,
        },
    });
}

// 쿠키 정보를 안전하게 가져오는 함수
const getCookiesInfo = () => {
    if (typeof document === 'undefined') return {};

    // 쿠키 문자열 파싱
    const cookies = document.cookie.split(';').reduce(
        (acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            if (key && value) {
                // 모든 쿠키 값을 그대로 포함
                acc[key] = value;
            }
            return acc;
        },
        {} as Record<string, string>
    );

    return cookies;
};

export const fetchUserId = async (context?: string) => {
    const supabase = createClient();

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            console.error('Session error:', sessionError.message, {
                context: context || 'unknown',
            });
            throw new Error(`Session error: ${sessionError.message}`);
        }
        const cookiesInfo = getCookiesInfo();
        if (!sessionData.session) {
            console.error('세션 정보가 없음. cookies를 확인해주세요.', {
                context: context || 'unknown',
                cookies: cookiesInfo,
            });
            throw new Error('No active session found');
        }
        if (!sessionData.session.user) {
            console.error('유저 정보가 없음. cookies를 확인해주세요.', {
                context: context || 'unknown',
                cookies: cookiesInfo,
            });
            throw new Error('No user associated with the session');
        }
        const userId = sessionData.session.user.id;
        return userId;
    } catch (error) {
        if (error instanceof Error) {
            console.error('fetchUserId error:', error.message, { context: context || 'unknown' });
        }
        throw error;
    }
};
