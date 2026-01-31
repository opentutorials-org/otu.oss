'use server';

import { cookies, headers } from 'next/headers';
import { LANG_COOKIE_NAME, defaultLocale, Locale, locales } from './functions/constants';
import { localeLogger } from './debug/locale';

export async function getUserLocale(): Promise<Locale> {
    localeLogger('getUserLocale 실행');
    const cookieLocale = (await cookies()).get(LANG_COOKIE_NAME)?.value as Locale;
    localeLogger('저장된 locale 값 : ', { cookieLocale, locales });
    if (cookieLocale && locales.includes(cookieLocale)) {
        return cookieLocale;
    }

    const browserLocale = await getBrowserLocale();
    localeLogger('저장된 locale 이 없으므로 사용자 환경을 가져옴 : %s', { browserLocale });
    if (browserLocale && locales.includes(browserLocale)) {
        return browserLocale;
    }

    localeLogger('브라우저 locale도 없으므로 기본 locale 로 설정함 : %s', { defaultLocale });
    return defaultLocale;
}

export async function setUserLocale(locale: Locale) {
    // 쿠키를 1년간 유지되도록 설정 (초 단위로 설정)
    const oneYearInSeconds = 365 * 24 * 60 * 60;
    (await cookies()).set(LANG_COOKIE_NAME, locale, {
        path: '/',
        maxAge: oneYearInSeconds,
        sameSite: 'lax',
    });
}

async function getBrowserLocale(): Promise<Locale | null> {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    if (!acceptLanguage) return null;

    const browserLocale = acceptLanguage.split(',')[0].split('-')[0];
    return locales.includes(browserLocale as Locale) ? (browserLocale as Locale) : null;
}
