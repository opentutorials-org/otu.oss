/**
 * 전역 타입 정의
 * - window.webview: Android WebView 인터페이스
 */

interface WebViewInterface {
    [funcName: string]: ((payload?: string) => void) | undefined;
    requestPushMessagePermissionToNative?: () => void;
    requestHapticFeedbackToNative?: () => void;
}

declare global {
    interface Window {
        webview?: WebViewInterface;
    }
}

export {};
