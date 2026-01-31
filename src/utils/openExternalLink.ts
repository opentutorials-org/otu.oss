import { communicateWithAppsWithCallback } from '@/components/core/WebViewCommunicator';
import { isReactNativeWebView } from '@/functions/detectEnvironment';

/**
 * 외부 링크를 여는 함수
 * - 웹뷰 환경에서는 네이티브 앱에 메시지를 전달하여 외부 브라우저에서 링크를 엽니다.
 * - 일반 웹 브라우저 환경에서는 새 창에서 링크를 엽니다.
 *
 * @param url 열고자 하는 외부 URL
 */
export function openExternalLink(url: string): void {
    if (isReactNativeWebView()) {
        // 웹뷰 환경: 네이티브 코드에 메시지 전달
        communicateWithAppsWithCallback('requestOpenExternalBrowserToNative', { url });
    } else {
        // 웹 브라우저 환경: 새 창으로 링크 열기
        window.open(url, '_blank');
    }
}
