import { getRequestConfig } from 'next-intl/server';
import { LANG_COOKIE_NAME, defaultLocale, Locale, locales } from './functions/constants';
import { localeLogger } from './debug/locale';
import { getUserLocale, setUserLocale } from './i18n-server';

export default getRequestConfig(async () => {
    const locale = await getUserLocale();
    localeLogger('locale 설정 : %s', { locale });
    return {
        locale,
        messages: (await import(`./messages/${locale}.json`)).default,
    };
});

export { getUserLocale, setUserLocale };
