import { useEffect } from 'react';
import { webviewLogger } from '@/debug/webview';
import { useNavigate } from 'react-router-dom';

/**
 * 네이티브 앱에서 "javascript:requestNewURLToWeb('...')" 형태로 호출하면
 * 웹뷰 내부에서 해당 함수를 실행하여 페이지를 이동하는 훅
 */
export function useDeepLinkWebView() {
    const navigate = useNavigate();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // @ts-ignore
            window.requestNewURLToWeb = (url: string) => {
                // URL에서 경로만 추출 (도메인 제거)
                try {
                    const urlObj = new URL(url, window.location.origin);
                    let pathname = urlObj.pathname + urlObj.search + urlObj.hash;

                    // /home 접두사 제거
                    if (pathname.startsWith('/home')) {
                        pathname = pathname.substring(5); // '/home' 제거
                    }

                    webviewLogger('🚀 ~ useDeepLinkWebView ~ pathname:', pathname);
                    navigate(pathname);
                } catch (e) {
                    // URL 파싱 실패 시 그대로 navigate 시도
                    navigate(url);
                }
            };
        }
    }, [navigate]);
}
