import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { setI18n } from '@lingui/react/server';
import { renderLogger } from '@/debug/render';
import { LinguiClientProvider } from '@/components/LinguiClientProvider';
import { loadCatalog, i18n } from '@/lib/lingui';
import { Viewport } from 'next';

import './globals.css';

const APP_NAME = 'OTU';
const APP_DEFAULT_TITLE = 'OTU';
const APP_TITLE_TEMPLATE = '%s - OTU';
const APP_DESCRIPTION = 'Memo is all you need';
export const metadata = {
    applicationName: APP_NAME,
    title: {
        default: APP_DEFAULT_TITLE,
        template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    appleWebApp: {
        statusBarStyle: 'default',
        title: APP_DEFAULT_TITLE,
        appleMobileWebAppTitle: APP_NAME,
        capable: true,
        startupImage: [
            {
                url: '/apple-touch-startup-image-750x1334.png',
                media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
            },
            {
                url: '/apple-touch-startup-image-1242x2208.png',
                media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)',
            },
        ],
    },
    formatDetection: {
        telephone: false,
        address: false,
    },
    openGraph: {
        type: 'website',
        siteName: APP_NAME,
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
    },
    twitter: {
        card: 'summary',
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
    },
    other: {
        'mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'default',
        'apple-touch-fullscreen': 'yes',
    },
    // icons와 manifest 제거
};
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: true,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: 'var(--bg-color)' },
        { media: '(prefers-color-scheme: dark)', color: 'var(--bg-color)' },
    ],
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
    renderLogger('root/layout.tsx');
    const locale = await getLocale();

    // Providing all messages to the client
    // side is the easiest way to get started
    const messages = await getMessages();

    // LinguiJS 초기화 - 컴파일된 카탈로그 로드
    const { messages: linguiMessages } = await import(`../src/locales/${locale}/messages.po`);
    loadCatalog(locale, linguiMessages);
    setI18n(i18n);

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `!function(){try{var e=null;try{e=localStorage.getItem("themeMode")}catch(t){}if(e)document.documentElement.className=JSON.parse(e);else{var t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.className=t?"black":"gray"}}catch(e){document.documentElement.className="gray"}}();`,
                    }}
                />
            </head>
            <body>
                <LinguiClientProvider initialLocale={locale} initialMessages={linguiMessages}>
                    <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
                </LinguiClientProvider>
            </body>
        </html>
    );
}
