'use client';

import { I18nProvider } from '@lingui/react';
import { type Messages, setupI18n } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import { useState } from 'react';

export function LinguiClientProvider({
    children,
    initialLocale,
    initialMessages,
}: {
    children: React.ReactNode;
    initialLocale: string;
    initialMessages: Messages;
}) {
    const [i18n] = useState(() => {
        const instance = setupI18n({
            locale: initialLocale,
            messages: { [initialLocale]: initialMessages },
        });
        instance.setMessagesCompiler(compileMessage);
        return instance;
    });
    return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
