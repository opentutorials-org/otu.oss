/**
 * 현재 실행 환경을 탐지합니다.
 * React Native WebView, Electron, 일반 브라우저를 구분합니다.
 * @returns {'ReactNativeWebView' | 'WebView' | 'Electron' | 'Browser'} 환경 타입
 */
export function detectEnvironment() {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

    // React Native WebView 탐지 - 가장 확실한 방법
    const isReactNativeWebView = typeof window.ReactNativeWebView !== 'undefined';

    // 일반 WebView 탐지 (Android/iOS)
    const isWebView = /wv/.test(userAgent) || /WebView/.test(userAgent);
    const isAndroidWebView = typeof window.Android !== 'undefined';
    const isIOSWebView = window.webkit && window.webkit.messageHandlers;

    // Electron 탐지
    const isElectron =
        (typeof window !== 'undefined' &&
            typeof window.process === 'object' &&
            window.process?.type === 'renderer') ||
        (typeof process !== 'undefined' &&
            typeof process.versions === 'object' &&
            !!(process.versions as any)?.electron);

    // 우선순위: React Native WebView > 일반 WebView > Electron > Browser
    if (isReactNativeWebView) {
        return 'ReactNativeWebView';
    } else if (isWebView || isAndroidWebView || isIOSWebView) {
        return 'WebView';
    } else if (isElectron) {
        return 'Electron';
    } else {
        return 'Browser';
    }
}

/**
 * React Native WebView 환경인지 확인합니다.
 * @returns {boolean} React Native WebView 여부
 */
export function isReactNativeWebView(): boolean {
    return typeof window.ReactNativeWebView !== 'undefined';
}

/**
 * 웹뷰 환경인지 확인합니다 (React Native WebView 포함).
 * @returns {boolean} 웹뷰 환경 여부
 */
export function isWebView(): boolean {
    const environment = detectEnvironment();
    return environment === 'ReactNativeWebView' || environment === 'WebView';
}

export function isAndroidWebViewOrBrowser(): boolean {
    const userAgent = navigator.userAgent || '';
    const isAndroid = /Android/i.test(userAgent);
    const isWebView = /\bwv\b/.test(userAgent) || /; wv\)/.test(userAgent); // 웹뷰 확인
    const isBrowser = isAndroid && !isWebView; // 웹뷰가 아니면 브라우저
    return isWebView || isBrowser;
}
