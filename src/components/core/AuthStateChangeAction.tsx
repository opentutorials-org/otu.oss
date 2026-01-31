'use client';

import { useEffect } from 'react';
import { createClient } from '@/supabase/utils/client';

import { authLogger } from '@/debug/auth';

export function AuthStateChangeAction() {
    // const openSnackbar = useSetAtom(openSnackbarState);
    // const t = useTranslations('auth');
    // const router = useRouter();

    useEffect(function handleAuthStateChange() {
        const supabase = createClient();
        supabase.auth.onAuthStateChange((event, session) => {
            authLogger('Auth state changed:', event);
            if (event === 'INITIAL_SESSION') {
                authLogger('Initial session:', session ? 'exists' : 'null');
                if (session === null) {
                } else {
                }
            } else if (event === 'SIGNED_IN') {
                authLogger('User signed in');
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    const redirect = url.searchParams.get('redirect');
                    const currentPath = window.location.pathname;
                    authLogger('Current path:', currentPath);

                    if (redirect) {
                        authLogger('Redirecting to redirect after sign in', redirect);
                        // URL 디코딩 후 이동
                        const decodedRedirect = decodeURIComponent(redirect);
                        authLogger('Decoded redirect:', decodedRedirect);
                        location.href = decodedRedirect;
                    } else if (!window.location.pathname.startsWith('/home')) {
                        authLogger('Navigating to home');
                        location.href = '/home';
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                authLogger('User signed out');
                // router.replace('/welcome'); // 제거: 각 로그아웃 시나리오가 자체적으로 리디렉션 처리
                // LoginedMenu, error/page, Withdraw, useSync에서 독립적으로 처리
            } else if (event === 'PASSWORD_RECOVERY') {
                authLogger('Password recovery event');
            } else if (event === 'TOKEN_REFRESHED') {
                authLogger('Token refreshed');
            } else if (event === 'USER_UPDATED') {
                authLogger('User updated');
            }
        });
    }, []);
    return null;
}
