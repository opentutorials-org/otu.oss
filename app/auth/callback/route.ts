import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/node';
import { addBetaTester } from '@/functions/hooks/addBetaTester';
import { authLogger } from '@/debug/auth';
import { createClient } from '@/supabase/utils/server';
import { handleNewUserSetup } from '@/functions/sample/handleNewUserSetup.server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // The `/auth/callback` route is required for the server-side auth flow implemented
    // by the Auth Helpers package. It exchanges an auth code for the user's session.
    // https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-sign-in-with-code-exchange
    authLogger('소셜 로그인 콜백 시작');

    // 프록시 환경과 직접 접근 환경 모두 지원
    const headersList = await headers();
    const forwardedHost = headersList.get('x-forwarded-host');

    let requestUrl: URL;
    if (forwardedHost) {
        // 프록시 환경: x-forwarded 헤더 사용
        const protocol = headersList.get('x-forwarded-proto') || 'https';
        const originalUrl = new URL(request.url);
        requestUrl = new URL(
            `${protocol}://${forwardedHost}${originalUrl.pathname}${originalUrl.search}`
        );
    } else {
        // 직접 접근: 기존 URL 그대로 사용
        requestUrl = new URL(request.url);
    }

    const code = requestUrl.searchParams.get('code');
    const cookieStore = await cookies();
    const supabase = await createClient();
    try {
        if (code) {
            const maskedCode = code.slice(0, 5) + '*'.repeat(code.length - 5);
            const result = await supabase.auth.exchangeCodeForSession(code);
            authLogger('소셜 로그인 코드 교환', 'code:', maskedCode, 'result:', result);
        }
    } catch (error) {
        Sentry.captureException(error);
    }
    const { data: userData } = await supabase.auth.getUser();
    authLogger('사용자 정보', userData);
    if (userData && userData.user) {
        const { data: betaData, error: betaError } = await addBetaTester(
            supabase,
            userData.user.id
        );
        if (betaError) {
            console.error(betaError);
        }
        // 로그인 풀림 이슈를 해결하기 위해 쿠키에 otuid를 저장
        cookieStore.set('OTUID', userData.user.id, {
            expires: new Date('9999-12-31'),
            httpOnly: false,
        });

        // 신규 사용자 설정 (usage 레코드 추가 + 샘플 페이지 생성)
        await handleNewUserSetup(userData.user.id, supabase, 'oauth');
    }

    const redirectTarget = buildRedirectUrl(requestUrl);
    authLogger('소셜 로그인 콜백 최종 리다이렉트', redirectTarget);
    return NextResponse.redirect(redirectTarget);
}

function buildRedirectUrl(requestUrl: URL): string {
    const redirectParam = requestUrl.searchParams.get('redirect');
    const origin = requestUrl.origin;

    if (!redirectParam) {
        return origin;
    }

    try {
        const resolvedUrl = new URL(redirectParam, origin);
        if (resolvedUrl.origin !== origin) {
            authLogger(
                '소셜 로그인 콜백 리다이렉트가 현재 호스트와 일치하지 않아 기본 호스트로 복귀',
                redirectParam,
                origin
            );
            return origin;
        }
        return resolvedUrl.href;
    } catch (error) {
        authLogger('소셜 로그인 콜백 리다이렉트 URL 파싱 실패', redirectParam, error);
        return origin;
    }
}
