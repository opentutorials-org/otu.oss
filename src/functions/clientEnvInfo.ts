import { isReactNativeWebView } from './detectEnvironment';

export function isInWebView(): boolean {
    return isReactNativeWebView();
}

export function getEnvOs(): string {
    if (isReactNativeWebView()) {
        // React Native WebView 환경에서 OS 구분
        if (window?.webkit?.messageHandlers) {
            return 'ios';
        } else if (window?.webview || (window as any)?.Android) {
            return 'android';
        } else {
            return 'react-native'; // 일반적인 React Native WebView
        }
    } else if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
        return 'browser';
    } else {
        return 'etc';
    }
}
