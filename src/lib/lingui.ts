import { i18n, setupI18n, type Messages } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { defaultLocale, type Locale } from '@/functions/constants';

// PO extract / compile 없이도 런타임에서 메시지 컴파일 가능하게 설정
// https://github.com/lingui/js-lingui/issues/2295
i18n.setMessagesCompiler(compileMessage);

export function loadCatalog(locale: string, messages: Messages) {
    i18n.load(locale, messages);
    i18n.activate(locale);
}

/**
 * API 라우트 등 서버 사이드에서 독립적인 i18n 인스턴스를 생성합니다.
 * 전역 i18n과 격리되어 동시 요청에서도 안전합니다.
 */
export async function getServerI18n(locale: Locale) {
    // 테스트 환경에서는 .po 파일 로딩을 건너뛰고 mock 반환
    if (process.env.NODE_ENV === 'test') {
        return {
            _: (descriptor: any) => {
                // msg 매크로 결과 처리: { id: string, message?: string } 형태
                if (typeof descriptor === 'string') return descriptor;
                if (descriptor?.message) return descriptor.message;
                if (descriptor?.id) return descriptor.id;
                return 'translated';
            },
        } as ReturnType<typeof setupI18n>;
    }

    try {
        const { messages } = await import(`../locales/${locale}/messages.po`);
        const serverI18n = setupI18n({
            locale,
            messages: { [locale]: messages },
        });
        serverI18n.setMessagesCompiler(compileMessage);
        return serverI18n;
    } catch (error) {
        console.error(
            `Failed to load locale "${locale}", falling back to "${defaultLocale}"`,
            error
        );
        const { messages } = await import(`../locales/${defaultLocale}/messages.po`);
        const serverI18n = setupI18n({
            locale: defaultLocale,
            messages: { [defaultLocale]: messages },
        });
        serverI18n.setMessagesCompiler(compileMessage);
        return serverI18n;
    }
}

export { i18n };
