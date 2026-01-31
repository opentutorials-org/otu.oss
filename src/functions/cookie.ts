import { defaultLocale, LANG_COOKIE_NAME, Locale, locales } from './constants';

export function getCookie(name: string): string | undefined {
    let cookie: { [key: string]: string } = {};
    document.cookie.split(';').forEach(function (el) {
        let [k, v] = el.split('=');
        cookie[k.trim()] = v;
    });
    return cookie[name];
}

export function setCookie(name: string, value: string, days?: number) {
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/';
}

export function getClientLocale(): Locale | null {
    const cookieLocale = getCookie(LANG_COOKIE_NAME) as Locale;
    if (cookieLocale && locales.includes(cookieLocale)) {
        return cookieLocale;
    }

    const browserLocale = getBrowserLocale();
    if (browserLocale && locales.includes(browserLocale)) {
        return browserLocale;
    }

    return defaultLocale;
}

export function setClientLocale(locale: Locale) {
    setCookie(LANG_COOKIE_NAME, locale, 365);
}

function getBrowserLocale(): Locale | null {
    const acceptLanguage = navigator.language || navigator.languages[0];
    if (!acceptLanguage) return null;

    const browserLocale = acceptLanguage.split('-')[0];
    return locales.includes(browserLocale as Locale) ? (browserLocale as Locale) : null;
}
