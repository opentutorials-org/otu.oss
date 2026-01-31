'use client';
import { createClient } from '@/supabase/utils/client';
import { setTag, setUser } from '@sentry/nextjs';
import { useEffect } from 'react';

export function useSentrySetUser() {
    setTag('webViewOs', 'NOT WEBVIEW');
    useEffect(() => {
        (async () => {
            const supabase = createClient();
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) {
                setUser({
                    id: session.user.id,
                    email: session.user.email,
                    ip_address: '{{auto}}',
                });
            }
        })();
    }, []);
}
