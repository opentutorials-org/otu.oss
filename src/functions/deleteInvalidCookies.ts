import { authLogger } from '@/debug/auth';
import { addBreadcrumb, captureMessage } from '@sentry/nextjs';
import { decode } from 'js-base64';

export function getCookiesAsObjects() {
    // document.cookie에서 쿠키 문자열을 가져옵니다.
    if (typeof window === 'undefined') {
        return [];
    }
    const cookiesString = document.cookie;

    // 세미콜론으로 쿠키들을 분리합니다.
    const cookiesArray = cookiesString.split('; ');

    // 각 쿠키 문자열을 {name, value} 객체로 변환하고, value 값을 디코딩합니다.
    const cookiesObjects = cookiesArray.map((cookie) => {
        const [name, encodedValue] = cookie.split('=');
        const value = decodeURIComponent(encodedValue); // URL 디코딩 적용
        return { name, value };
    });

    return cookiesObjects;
}
export type deleteInvalidCookiesType = (
    cookies: { name: string; value: string }[],
    storageKey: string,
    deleteCallback: (name: string) => void
) => void;
export const deleteInvalidCookies: deleteInvalidCookiesType = (
    cookies,
    storageKey,
    deleteCallback
) => {
    const filteredCookies = cookies.filter((cookie) => {
        const name = cookie.name;
        const value = cookie.value;
        const containsStorageKey = name.includes(storageKey + '.');
        return containsStorageKey;
    });
    const sortedCookies = filteredCookies.sort((a, b) => {
        const numA = parseInt(a.name.split('.').pop() || '0', 10);
        const numB = parseInt(b.name.split('.').pop() || '0', 10);
        return numA - numB;
    });
    addBreadcrumb({
        category: 'auth',
        message: 'sortedCookies',
        level: 'info',
        data: {
            sortedCookies,
        },
    });
    authLogger('deleteInvalidCookiesType/sortedCookies.length', sortedCookies.length);
    if (sortedCookies.length > 0) {
        let combinedValue = '';
        let validFormatEndIndex: number | null = null;
        authLogger('deleteInvalidCookiesType/parsing start');
        for (let i = 0; i < sortedCookies.length; i++) {
            combinedValue += sortedCookies[i].value;
            authLogger('deleteInvalidCookiesType/value', sortedCookies[i].value);
            try {
                authLogger('deleteInvalidCookiesType/trying to decode and parse', combinedValue);
                const base64Value = combinedValue.replace(/^base64-/, ''); // base64- 접두사 제거
                authLogger('deleteInvalidCookiesType/after base64');
                const decodedValue = decode(base64Value); // base64 디코딩
                authLogger('deleteInvalidCookiesType/after atob');
                const parsed = JSON.parse(decodedValue); // JSON 파싱
                authLogger('deleteInvalidCookiesType/after JSON.parse');
                validFormatEndIndex = i;
                authLogger('deleteInvalidCookiesType/validFormatEndIndex', validFormatEndIndex);
                addBreadcrumb({
                    category: 'auth',
                    message: '쿠키 포맷 검사',
                    level: 'info',
                    data: {
                        combinedValue,
                        decodedValue,
                        parsed,
                    },
                });
                break;
            } catch (e) {
                const error = e as Error;
                authLogger(
                    '   쿠키 파싱 가능성 테스트 결과 실패 - 이 메시지는 쿠키의 파싱 가능성을 체크하기 위한 것입니다. 정상적인 체크 과정이니 무시하세요.',
                    error.message
                );
                addBreadcrumb({
                    category: 'auth',
                    message: '쿠키 파싱 가능성 실패',
                    level: 'info',
                    data: {
                        error: error.message,
                    },
                });
            }
        }
        authLogger('parsing end');
        if (validFormatEndIndex === null) {
            if (sortedCookies.length > 0) {
                // 모든 부분에서 문제가 있어서 전체 데이터를 삭제해야 한다.
                validFormatEndIndex = 0;
                authLogger(
                    'deleteInvalidCookiesType/정상적인 인증쿠키가 아닙니다. 전체 삭제해야 합니다만, 현재는 이에 대한 구현이 되어 있지 않습니다.'
                );
                captureMessage(
                    '정상적인 인증쿠키가 아닙니다. 전체 삭제해야 합니다만, 현재는 이에 대한 구현이 되어 있지 않습니다. 이 문제가 보고되면 조사하세요:' +
                        combinedValue,
                    {
                        extra: {
                            cookies: sortedCookies,
                            combinedValue,
                        },
                    }
                );
            }
        } else {
            // delete cookies
            for (let j = validFormatEndIndex + 1; j < sortedCookies.length; j++) {
                deleteCallback(sortedCookies[j].name);
                addBreadcrumb({
                    category: 'auth',
                    message: '유효하지 않은 쿠기 삭제',
                    level: 'info',
                    data: {
                        combinedValue,
                        sortedCookies,
                        deletedCookie: sortedCookies[j],
                    },
                });
                authLogger('deleteInvalidCookiesType/유효하지 않은 쿠기 삭제', sortedCookies[j]);
            }
        }
    }
};
export function deleteCookie(name: string) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}
// deleteInvalidCookies(getCookiesAsObjects(), 'sb-localhost-auth-token', name => {
//     deleteCookie(name);
// })

function extractId(name: string) {
    //@ts-ignore
    return parseInt(name.split('.').pop());
}

type deleteNextCookieType = (
    cookies: { name: string; value: string }[],
    storageKey: string,
    onInvalidCookieFound: (name: string) => void
) => void;
export const deleteNextCookie: deleteNextCookieType = (
    cookies,
    storageKey,
    onInvalidCookieFound
) => {
    const filteredCookies = cookies.filter((cookie) => {
        const name = cookie.name;
        const value = cookie.value;
        const containsStorageKey = name.includes(storageKey + '.');
        return containsStorageKey;
    });

    const sortedCookies = filteredCookies.sort((a, b) => {
        const numA = parseInt(a.name.split('.').pop() || '0', 10);
        const numB = parseInt(b.name.split('.').pop() || '0', 10);
        return numA - numB;
    });

    if (sortedCookies.length > 0) {
        const lastCookieName = sortedCookies[sortedCookies.length - 1].name;
        const nextId = extractId(lastCookieName) + 1;
        onInvalidCookieFound(`sb-localhost-auth-token.${nextId}`);
    }
};

type getStorageKeyType = (NEXT_PUBLIC_SUPABASE_URL: string) => string;
export const getStorageKey: getStorageKeyType = (NEXT_PUBLIC_SUPABASE_URL) => {
    if (NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_URL.endsWith('supabase.co')) {
        const subdomain = NEXT_PUBLIC_SUPABASE_URL.split('.')[0].replace('https://', '');
        return `sb-${subdomain}-auth-token`;
    } else if (NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_URL.includes('localhost')) {
        return 'sb-localhost-auth-token';
    } else if (
        NEXT_PUBLIC_SUPABASE_URL &&
        /^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}/.test(NEXT_PUBLIC_SUPABASE_URL)
    ) {
        // IP 주소 형식인 경우
        const firstNumberMatch = NEXT_PUBLIC_SUPABASE_URL.match(/(\d+)/); // 첫 번째 숫자 부분을 찾음
        if (firstNumberMatch) {
            const firstNumber = firstNumberMatch[0]; // 첫 번째 숫자 추출
            return `sb-${firstNumber}-auth-token`; // 첫 번째 숫자를 사용해 토큰 생성
        }
        throw new Error('IP 주소에서 첫 번째 숫자를 찾지 못했습니다. ');
    } else if (
        NEXT_PUBLIC_SUPABASE_URL &&
        /^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+/.test(NEXT_PUBLIC_SUPABASE_URL)
    ) {
        const subdomain = NEXT_PUBLIC_SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0]; // 첫 번째 서브도메인 추출
        return `sb-${subdomain}-auth-token`; // 첫 번째 서브도메인을 사용해 토큰 생성
    } else {
        throw new Error('스토리지 키를 생성하지 못했습니다. ');
    }
};
