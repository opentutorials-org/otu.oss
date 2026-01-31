import { Database } from '@/lib/database/types';
import { createBrowserClient } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
import * as Sentry from '@sentry/nextjs';
// @ts-ignore

let debug = false;
if (typeof window !== 'undefined') {
    debug = localStorage.getItem('debug')?.includes('auth') || false;
}
export function createClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                debug: process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED
                    ? process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED === 'true'
                    : false,
            },
        }
    );
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

    // 호출 맥락에 관한 breadcrumb 추가
    try {
        // 호출 스택 정보 수집
        const stackTrace = new Error().stack || '';
        const callerInfo = stackTrace
            .split('\n')
            .slice(2, 3) // 첫 번째는 Error 생성자, 두 번째는 현재 함수, 세 번째부터 호출자 정보
            .map((line) => line.trim())
            .join(' ');

        // URL과 컴포넌트 정보 수집 (브라우저 환경인 경우)
        let urlInfo = '';
        let componentInfo = '';

        if (typeof window !== 'undefined') {
            urlInfo = window.location.href;

            // React DevTools가 있는 경우, 현재 컴포넌트 이름을 가져오려는 시도
            // 단, 이는 개발 환경에서만 작동하고 제한적임
            componentInfo = context || '';
        }

        // Breadcrumb 추가
        Sentry.addBreadcrumb({
            category: 'auth',
            message: 'fetchUserId 함수 호출',
            level: 'info',
            data: {
                callerInfo,
                context: context || '호출 맥락 정보 없음',
                url: urlInfo,
                component: componentInfo,
                timestamp: new Date().toISOString(),
            },
        });

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            // 세션 에러 발생 시 에러 캡처
            Sentry.addBreadcrumb({
                category: 'auth',
                message: `Session error: ${sessionError.message}`,
                level: 'error',
                data: {
                    errorType: 'session_error',
                    context: context || 'unknown',
                },
            });
            throw new Error(`Session error: ${sessionError.message}`);
        }
        const cookiesInfo = getCookiesInfo();
        if (!sessionData.session) {
            // 세션이 없는 경우 에러 캡처
            Sentry.captureException(new Error('세션 정보가 없음. cookies를 확인해주세요.'), {
                extra: {
                    context: context || 'unknown',
                    cookies: cookiesInfo,
                    localStorageKeys:
                        typeof window !== 'undefined' ? Object.keys(localStorage) : [],
                    timestamp: new Date().toISOString(),
                },
            });
            throw new Error('No active session found');
        }
        if (!sessionData.session.user) {
            // 유저 정보가 없는 경우 에러 캡처
            Sentry.captureException(new Error('유저 정보가 없음. cookies를 확인해주세요.'), {
                extra: {
                    context: context || 'unknown',
                    cookies: cookiesInfo,
                    localStorageKeys:
                        typeof window !== 'undefined' ? Object.keys(localStorage) : [],
                    timestamp: new Date().toISOString(),
                },
            });
            throw new Error('No user associated with the session');
        }
        const userId = sessionData.session.user.id;
        return userId;
    } catch (error) {
        // 예상치 못한 에러가 발생한 경우 에러 캡처
        if (error instanceof Error) {
            Sentry.addBreadcrumb({
                category: 'auth',
                message: error.message,
                level: 'error',
                data: {
                    errorType: 'fetch_user_id_error',
                    context: context || 'unknown',
                },
            });
        }
        throw error;
    }
};
