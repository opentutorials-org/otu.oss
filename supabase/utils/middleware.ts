import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ipAddress } from '@vercel/functions';
// @ts-ignore
import { authLogger } from '@/debug/auth';
import { utf8Logger, cookieLogger } from '@/debug/middleware';
import { cookies } from 'next/headers';
import { reportValue } from '@vercel/flags';
import { getSupabaseConfig } from './config';

function getUserIp(request: NextRequest): string {
    const xForwardedFor = request.headers.get('x-forwarded-for');

    if (xForwardedFor) {
        // IP가 여러 개일 경우 첫 번째 IP를 사용
        const ips = xForwardedFor.split(',').map((ip) => ip.trim());
        if (ips.length > 0 && ips[0]) {
            return ips[0];
        }
    }
    // x-forwarded-for이 없거나 비어 있을 경우, request.ip 사용
    return ipAddress(request) || '0.0.0.0'; // 기본값으로 '0.0.0.0' 반환
}

// optimizeTokenFragments 반환 타입
interface TokenOptimizationResult {
    cookies: Array<{ name: string; value: string }>;
    invalidFragmentNames: string[];
}

// 토큰 조각을 점진적으로 파싱하는 함수
function optimizeTokenFragments(
    cookies: Array<{ name: string; value: string }>
): TokenOptimizationResult {
    cookieLogger('토큰 조각 최적화 시작');

    // Supabase auth-token 조각들 찾기
    const authTokenPattern = /sb-.*-auth-token\.(\d+)$/;
    const authTokenCookies = cookies.filter((cookie) => authTokenPattern.test(cookie.name));

    if (authTokenCookies.length === 0) {
        cookieLogger('auth-token 조각이 없어 최적화 건너뜀');
        return { cookies, invalidFragmentNames: [] };
    }

    // 조각들을 번호 순으로 정렬
    authTokenCookies.sort((a, b) => {
        const aMatch = a.name.match(authTokenPattern);
        const bMatch = b.name.match(authTokenPattern);
        const aIndex = aMatch ? parseInt(aMatch[1]) : 0;
        const bIndex = bMatch ? parseInt(bMatch[1]) : 0;
        return aIndex - bIndex;
    });

    cookieLogger(`발견된 토큰 조각: ${authTokenCookies.length}개`);
    authTokenCookies.forEach((cookie, index) => {
        cookieLogger(`  조각 ${index}: ${cookie.name} (${cookie.value.length}바이트)`);
    });

    // 점진적으로 조각을 합쳐서 파싱 시도
    let validFragments: Array<{ name: string; value: string }> = [];
    let combinedValue = '';

    for (let i = 0; i < authTokenCookies.length; i++) {
        const fragment = authTokenCookies[i];

        // base64- 접두사 제거 후 합치기
        const fragmentValue = fragment.value.startsWith('base64-')
            ? fragment.value.substring(7)
            : fragment.value;

        combinedValue += fragmentValue;

        try {
            // base64 디코딩 시도
            const decoded = atob(combinedValue);
            cookieLogger(`조각 ${i + 1}개로 base64 디코딩 성공: ${decoded.length}바이트`);

            // JSON 파싱 시도
            const parsed = JSON.parse(decoded);

            // 유효한 토큰인지 확인
            if (parsed.access_token && parsed.user) {
                cookieLogger(`✅ 조각 ${i + 1}개로 유효한 토큰 파싱 성공!`);
                cookieLogger(`  사용자 ID: ${parsed.user.id}`);
                cookieLogger(`  토큰 만료: ${new Date(parsed.expires_at * 1000).toISOString()}`);

                // 이 조각들까지만 유효하다고 저장
                validFragments = authTokenCookies.slice(0, i + 1);
                break;
            } else {
                cookieLogger(`조각 ${i + 1}개로 파싱 성공했지만 토큰 구조 불완전`);
            }
        } catch (error) {
            cookieLogger(`조각 ${i + 1}개로 파싱 실패: ${error}`);
            // 계속 다음 조각 추가해서 시도
        }
    }

    // 최적화 결과 적용
    if (validFragments.length > 0 && validFragments.length < authTokenCookies.length) {
        cookieLogger(
            `🔧 토큰 조각 최적화: ${authTokenCookies.length}개 → ${validFragments.length}개`
        );

        // 불필요한 조각 이름을 반환값으로 전달 (global 변수 사용 제거)
        const invalidFragments = authTokenCookies.slice(validFragments.length);
        const invalidFragmentNames = invalidFragments.map((f) => f.name);

        invalidFragments.forEach((fragment) => {
            cookieLogger(`🗑️ 더미 조각 삭제 예약: ${fragment.name}`);
        });

        // 유효한 조각들만 남기고 나머지 제거
        const validFragmentNames = new Set(validFragments.map((f) => f.name));
        const optimizedCookies = cookies.filter((cookie) => {
            if (authTokenPattern.test(cookie.name)) {
                return validFragmentNames.has(cookie.name);
            }
            return true; // 다른 쿠키들은 그대로 유지
        });

        cookieLogger(`최종 쿠키 개수: ${cookies.length} → ${optimizedCookies.length}`);
        cookieLogger(`🎯 삭제 예약된 더미 조각: ${invalidFragmentNames.length}개`);
        return { cookies: optimizedCookies, invalidFragmentNames };
    } else if (validFragments.length === 0) {
        cookieLogger('⚠️ 유효한 토큰 조각을 찾을 수 없음 - 원본 유지');
        return { cookies, invalidFragmentNames: [] };
    } else {
        cookieLogger('모든 조각이 필요함 - 최적화 불필요');
        return { cookies, invalidFragmentNames: [] };
    }
}

export async function updateSession(request: NextRequest) {
    const config = getSupabaseConfig();
    if (!config) {
        // Supabase 환경변수가 설정되지 않은 경우 세션 처리를 건너뛰고
        // 요청을 그대로 통과시킵니다.
        return NextResponse.next({ request });
    }

    const debug = process.env.DEBUG?.includes('auth') || false;
    const cookieStore = await cookies();
    authLogger('updateSession', { path: request.nextUrl.pathname });
    authLogger('debug', process.env.DEBUG, debug);

    // 요청 스코프 변수: global 대신 사용하여 race condition 방지
    let invalidFragmentNamesToDelete: string[] = [];

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(config.url, config.anonKey, {
        auth: {
            debug: process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED
                ? process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED === 'true'
                : false,
        },
        cookies: {
            getAll() {
                try {
                    const rawData = request.cookies.getAll();
                    cookieLogger('getAll 시작 - 원본 쿠키 개수:', rawData.length);

                    // 토큰 조각 최적화 적용 (결과를 요청 스코프 변수에 저장)
                    const result = optimizeTokenFragments(rawData);
                    invalidFragmentNamesToDelete = result.invalidFragmentNames;
                    cookieLogger('getAll - 최적화 후 쿠키 개수:', result.cookies.length);

                    authLogger('getAll', result.cookies);
                    cookieLogger('getAll 완료 - 최적화된 쿠키 반환');
                    return result.cookies;
                } catch (error) {
                    utf8Logger('getAll에서 치명적 오류 발생:', error);
                    cookieLogger('getAll 오류 상세:', error);
                    throw error;
                }
            },
            setAll(cookiesToSet) {
                try {
                    cookieLogger('setAll 시작 - 설정할 쿠키 개수:', cookiesToSet.length);

                    authLogger('setAll', cookiesToSet);
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        return supabaseResponse.cookies.set(name, value, options);
                    });
                    cookieLogger('setAll 완료');
                } catch (error) {
                    utf8Logger('setAll에서 치명적 오류 발생:', error);
                    cookieLogger('setAll 오류 상세:', error);
                    throw error;
                }
            },
        },
    });
    // 🔥 getUser 호출 시 UTF-8 오류 처리 추가
    let user;
    try {
        user = await supabase.auth.getUser();
        cookieLogger('supabase.auth.getUser() 성공');
    } catch (authError) {
        utf8Logger('supabase.auth.getUser()에서 오류 발생:', authError);

        // UTF-8 관련 오류인지 확인
        const errorMessage = (authError as Error)?.message || authError?.toString() || '';
        if (errorMessage.includes('UTF-8') || errorMessage.includes('Invalid UTF-8')) {
            utf8Logger('UTF-8 시퀀스 오류 확인됨 - 사용자를 비로그인 상태로 처리');
            user = {
                data: { user: null },
                error: null,
            };
        } else {
            throw authError;
        }
    }

    // 불필요한 토큰 조각들을 실제로 클라이언트에서 삭제 (요청 스코프 변수 사용)
    if (invalidFragmentNamesToDelete.length > 0) {
        cookieLogger(`🗑️ 더미 조각 삭제 실행: ${invalidFragmentNamesToDelete.length}개`);

        invalidFragmentNamesToDelete.forEach((fragmentName: string) => {
            supabaseResponse.cookies.set(fragmentName, '', {
                path: '/',
                maxAge: 0,
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
            });
            cookieLogger(`  ✅ ${fragmentName} 삭제 완료`);
        });

        cookieLogger(`🎉 모든 더미 조각 삭제 완료!`);
    }

    // 로그인 풀림 이슈 디버깅
    if (!user.data.user) {
        authLogger('User is not authenticated in middleware', {
            'user.data.user': user.data.user,
            'user.error': user.error,
        });

        // Supabase 인증 토큰 쿠키가 있지만 사용자가 없는 경우, 쿠키를 삭제하여 무한 리디렉션을 방지합니다.
        const authCookiePattern = /sb-.*-auth-token.*/;
        const requestCookies = request.cookies.getAll();
        const authCookiesExist = requestCookies.some((c) => authCookiePattern.test(c.name));

        if (authCookiesExist) {
            authLogger(
                'User is not authenticated, but auth cookies were found. Clearing them to prevent a redirect loop.'
            );
            requestCookies.forEach((cookie) => {
                if (authCookiePattern.test(cookie.name)) {
                    supabaseResponse.cookies.set(cookie.name, '', {
                        maxAge: 0,
                        path: '/',
                    });
                }
            });
        }
    }

    // OTUID 쿠키가 있는 경우 사용자 설정
    const otuidCookie = await cookieStore.get('OTUID');
    if (otuidCookie && otuidCookie.value) {
        // 현재 시간을 구하고, 하루 전 시간을 계산합니다.
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        // startDate와 endDate를 해당 시간으로 설정합니다.
        const startDate = oneDayAgo;
        const endDate = now;

        // searchQuery를 logStr로 설정합니다.
        const logStr = `OTUID - ${otuidCookie.value}`;
        console.log(logStr);
    }

    // 로그인되어 있지 않고 OTUID 쿠키가 있는 경우
    if (!user.data.user && otuidCookie && otuidCookie.value.length > 0) {
        // 로그인 풀림 이슈 보고 및 OTUID 쿠키 삭제
        reportValue('auth_terminated', true);
        const cookiesAll = await cookieStore.getAll();
        console.error('미들웨어에서 로그인 풀림이 발생했습니다.', { cookies: cookiesAll });
        supabaseResponse.cookies.set('OTUID', '', {
            maxAge: 0,
            path: '/',
        });
    }

    // 로그인된 사용자 처리
    if (user.data.user) {
        // 로그인 풀림 이슈 방지를 위해 OTUID 쿠키에 사용자 ID 저장
        supabaseResponse.cookies.set('OTUID', user.data.user.id, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365, // 1년
            path: '/',
        });
    }

    const requestUrlObj = new URL(request.url);
    const path = requestUrlObj.pathname;
    const search = requestUrlObj.search || '';
    const isLogin = !!user.data.user;

    const redirectPath = determineRedirectPath(path, search, isLogin);

    if (redirectPath) {
        const redirectUrl = new URL(redirectPath, request.url);
        const redirectResponse = NextResponse.redirect(redirectUrl);

        // 현재 응답에 설정된 쿠키들을 리디렉션 응답에도 복사합니다.
        supabaseResponse.cookies.getAll().forEach((cookie) => {
            redirectResponse.cookies.set(cookie.name, cookie.value, getCookieOptions(cookie));
        });

        authLogger('Redirecting to:', redirectUrl.toString());
        return redirectResponse;
    }

    authLogger('pass to', path, 'cookie', supabaseResponse.cookies.toString());
    return supabaseResponse;
}

function getCookieOptions(cookie: any) {
    return {
        domain: cookie.domain || undefined, // 기본값 명시적 처리
        path: cookie.path || '/',
        expires: cookie.expires || undefined,
        httpOnly: cookie.httpOnly ?? true, // httpOnly 기본값
        secure: cookie.secure !== undefined ? cookie.secure : process.env.NODE_ENV === 'production',
        sameSite: cookie.sameSite || 'Lax', // 기본값을 Lax로 설정
    };
}

/**
 * 요청 경로와 로그인 상태에 따라 리디렉션할 경로를 결정합니다.
 * 모든 리디렉션 로직을 이 함수에 중앙화하여 무한 리디렉션을 방지하고 코드를 명확하게 관리합니다.
 * @param path 현재 요청 경로
 * @param search 현재 요청의 쿼리 문자열
 * @param isLogin 사용자 로그인 여부
 * @returns 리디렉션이 필요하면 새로운 경로를, 그렇지 않으면 null을 반환합니다.
 */
function determineRedirectPath(path: string, search: string, isLogin: boolean): string | null {
    authLogger('determineRedirectPath 호출됨', { path, isLogin });

    // 로그인 사용자 처리
    if (isLogin) {
        authLogger('로그인된 사용자 처리');
        if (
            path === '/' ||
            path.startsWith('/welcome') ||
            path.startsWith('/signin') ||
            path.startsWith('/signup') ||
            path.startsWith('/switchOnlineUser')
        ) {
            authLogger('로그인된 사용자가 인증 관련 페이지 접근 -> /home/page로 리디렉션');
            return '/home/page';
        }

        if (path === '/home') {
            authLogger('로그인된 사용자가 /home 접근 -> /home/page로 리디렉션');
            return '/home/page';
        }

        authLogger('로그인된 사용자 기타 경로 접근 -> 리디렉션 없음');
        return null;
    }
    // 로그아웃 사용자 처리
    else {
        authLogger('로그아웃된 사용자 처리');

        if (path.startsWith('/home')) {
            authLogger('로그아웃된 사용자가 /home/* 접근 -> /signin으로 리디렉션');
            return `/signin?redirect=${encodeURIComponent(path + search)}`;
        }

        if (path === '/') {
            authLogger('로그아웃된 사용자가 / 접근 -> /welcome으로 리디렉션');
            return '/welcome';
        }

        authLogger('로그아웃된 사용자 기타 경로 접근 -> 리디렉션 없음');
        return null;
    }
}
