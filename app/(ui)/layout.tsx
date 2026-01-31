'use client';
import { MuiThemeProvider } from '@/components/core/MuiThemeProvider';
import { Provider as JotaiProvider, getDefaultStore } from 'jotai';
import React from 'react';
import '@/app/globals.css';

import { WebViewCommunicator } from '@/components/core/WebViewCommunicator';
import { AuthStateChangeAction } from '@/components/core/AuthStateChangeAction';
import { useCalculateViewportHeight } from '@/functions/hooks/useCalculateViewportHeight';
import { useRequestStartWebviewToNative } from '@/functions/hooks/useRequestStartWebviewToNative';
import { useSentrySetUser } from '@/functions/hooks/useSentrySetUser';
import { renderLogger } from '@/debug/render';
import useEruda from '@/functions/hooks/useEruda';
import { RootLayoutProvider } from '@/app/RootLayoutProvider';

function Layout({ children }: { children: React.ReactNode }) {
    renderLogger('root/(ui)/layout.tsx');
    useCalculateViewportHeight();
    useRequestStartWebviewToNative();
    useSentrySetUser();
    useEruda();
    return (
        <MuiThemeProvider>
            {children}

            <WebViewCommunicator />
            <AuthStateChangeAction />
        </MuiThemeProvider>
    );
}

export default function JotaiRoot({ children }: { children: React.ReactNode }) {
    const store = getDefaultStore();
    return (
        <JotaiProvider store={store}>
            <RootLayoutProvider>
                <Layout>{children}</Layout>
            </RootLayoutProvider>
        </JotaiProvider>
    );
}
