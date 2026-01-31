import { i18n, type Messages } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';

// PO extract / compile 없이도 런타임에서 메시지 컴파일 가능하게 설정
// https://github.com/lingui/js-lingui/issues/2295
i18n.setMessagesCompiler(compileMessage);

export function loadCatalog(locale: string, messages: Messages) {
    i18n.load(locale, messages);
    i18n.activate(locale);
}

export { i18n };
