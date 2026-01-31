import { webviewLogger } from '@/debug/webview';
import { openSnackbarState, themeModeState } from '@/lib/jotai';
import { createClient } from '@/supabase/utils/client';
import { captureException } from '@sentry/nextjs';
import { useAtom, useSetAtom } from 'jotai';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function WebViewCommunicator() {
    const [themeMode] = useAtom(themeModeState);
    const pathname = usePathname();
    const [user, setUser] = useState<{ status: number; user: null | object }>({
        status: SESSION_STATE.LOADING,
        user: null,
    });

    useEffect(() => {
        // DOM 조작은 RootLayoutProvider가 담당
        // 여기서는 네이티브 앱에 테마 변경 알림만 전송
        const data = { darkMode: themeMode === 'black' ? 'dark' : 'light' };
        communicateWithAppsWithCallback('themeChanged', data);
    }, [themeMode]);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.onAuthStateChange((event, session) => {
            if (session === null || session.user === null) {
                setUser({ status: SESSION_STATE.UNAUTHENTICATED, user: null });
                communicateWithAppsWithCallback('requestAuthChangeToNative', {
                    event,
                    user: null,
                });
            } else {
                setUser({
                    status: SESSION_STATE.AUTHENTICATED,
                    user: session.user,
                });
                communicateWithAppsWithCallback('requestAuthChangeToNative', {
                    event,
                    user: session.user,
                });
            }
        });
    }, []);

    function sendWebViewStatus(
        pathname: string | null,
        user: { status: number; user: null | object }
    ) {
        // iOS , Aodn 메시지를 준다.  로 메지를 준다.
        const data = { pathname: pathname, user: user };
        // @ts-ignore
        window.webkit?.messageHandlers?.statusChanged?.postMessage(data);
    }
    useEffect(() => {
        sendWebViewStatus(pathname, user);
    }, [pathname, user]);

    return null;
}

/**
 * 네이티브 앱과의 통신을 처리하는 함수
 * - iOS와 Android 웹뷰 환경에 따라 적절한 메시지 핸들러를 호출합니다.
 * - 데이터를 직렬화하여 네이티브 코드로 전달합니다.
 *
 * @param funcName - 호출할 네이티브 함수 이름
 * @param data - 네이티브 코드로 전달할 데이터 (선택 사항)
 * @param callback - 네이티브 코드에서 호출할 콜백 함수 (선택 사항)
 */
export function communicateWithAppsWithCallback(funcName: string, data?: any, callback?: Function) {
    try {
        webviewLogger('communicateWithAppsWithCallback', { funcName, data });

        const executeCallback = (cb?: Function) => {
            if (cb && typeof cb === 'function') {
                cb();
            }
        };

        if (window.webkit?.messageHandlers?.[funcName]) {
            // iOS 웹뷰 환경
            window.webkit.messageHandlers[funcName].postMessage(data);
            executeCallback(callback);
        } else if (window.webview?.[funcName]) {
            // 아래 조건문들의 네이티브 콜은 작동을 하지 않아서 따로 처리해주었습니다. 원인은 모릅니다.
            if (funcName === 'requestPushMessagePermissionToNative') {
                window.webview?.requestPushMessagePermissionToNative?.();
                return;
            }
            if (funcName === 'requestHapticFeedbackToNative') {
                // 웹 API 사용 (안드로이드)
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(40); // 50ms 진동
                    return;
                }
                // iOS는 기존 네이티브 호출 유지
                window.webview?.requestHapticFeedbackToNative?.();
                return;
            }
            // Android 웹뷰 환경
            if (data === undefined) {
                // 데이터가 없으면 인자 없이 함수 호출
                window.webview?.[funcName]?.();
            } else {
                // 데이터가 있으면 적절히 변환하여 전달
                const payload = typeof data === 'object' ? JSON.stringify(data) : data;
                window.webview?.[funcName]?.(payload);
            }
            executeCallback(callback);
        }
    } catch (error) {
        console.error(`WebView communication error for "${funcName}":`, error);
        captureException(error); // Sentry에 에러 보고
    }
}

const SESSION_STATE = {
    LOADING: 0,
    UNAUTHENTICATED: 1,
    AUTHENTICATED: 2,
    WAITING: 3,
};
