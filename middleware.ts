import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './supabase/utils/middleware';
import { generateIdentifier } from './src/functions/logHeader';
// Vercel 전용: 셀프호스팅 환경에서는 @vercel/flags가 없을 수 있음
function safeReportValue(key: string, value: any) {
    try {
        require('@vercel/flags').safeReportValue(key, value);
    } catch {
        // @vercel/flags 미설치 시 무시
    }
}
import { middleWareLogger } from './src/debug/middleware';
import { defaultLanguage, supportedLanguages } from './src/functions/constants';

export async function middleware(req: NextRequest) {
    try {
        const requestId = generateIdentifier();
        middleWareLogger(`MIDDLEWARE : ${requestId} → ${new URL(req.url).pathname}`);
        safeReportValue('requestId', requestId);
        if (req.nextUrl.pathname === '/') {
            const requestedLang = req.nextUrl.searchParams.get('lang');
            if (requestedLang) {
                const existingLocale = req.cookies.get('OTU_LOCALE');

                if (!existingLocale) {
                    // 언어 코드 추출 (예: ko-KR에서 ko 추출)
                    const languageCode = requestedLang.split('-')[0].toLowerCase();

                    // 추출한 언어가 지원되는지 확인 (messages 폴더에 해당 언어 파일이 있는지)
                    let languageToSet = defaultLanguage;
                    if (supportedLanguages.includes(languageCode)) {
                        languageToSet = languageCode;
                    }

                    const responseUrl = new URL(req.url);
                    responseUrl.searchParams.delete('lang');
                    const response = NextResponse.redirect(responseUrl);
                    // 쿠키를 1년간 유지되도록 설정 (초 단위로 설정)
                    const oneYearInSeconds = 365 * 24 * 60 * 60;
                    response.cookies.set('OTU_LOCALE', languageToSet, {
                        path: '/',
                        maxAge: oneYearInSeconds,
                        sameSite: 'lax',
                    });
                    middleWareLogger(
                        `?lang=${requestedLang}에서 ${languageToSet}로 추출하여 쿠키를 설정한 후 리디렉션합니다.`
                    );
                    return response;
                }
                middleWareLogger(`이미 OTU_LOCALE 쿠키가 있어 언어 설정을 유지합니다.`);
            }
        }
        const response = await updateSession(req);
        response.headers.set('x-request-id', requestId);
        return response;
    } catch (e) {
        const errorUrl = new URL('/error', req.url);
        console.error('Middleware error:', e);
        return NextResponse.redirect(errorUrl);
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         * - .well-known/ (모든 .well-known 하위 엔드포인트)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!src/internal/|src/lib/|_next|src/packages|error|favicon.ico|sw.js|manifest.json|.well-known/|_vercel|monitoring|api/usage/reset|api/check/version|api/reminder/schedule|p|api/refresh_token_check|api/usage/webhook|api/usage/uploadcare/webhook|api/ai|.*\\.(?:xml|svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
