'use client';
import { communicateWithAppsWithCallback } from '@/components/core/WebViewCommunicator';
import { useEffect } from 'react';

export function useRequestStartWebviewToNative() {
    useEffect(() => {
        communicateWithAppsWithCallback('requestStartWebviewToNative');
    }, []);
}
