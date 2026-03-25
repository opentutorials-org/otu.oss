import { Database } from '@/lib/database/types';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig, SUPABASE_NOT_CONFIGURED_MESSAGE } from './config';

export async function createClient(url?: string, key?: string) {
    const config = getSupabaseConfig();
    const resolvedUrl = url ?? config?.url;
    const resolvedKey = key ?? config?.anonKey;

    if (!resolvedUrl || !resolvedKey) {
        throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
    }

    const cookieStore = await cookies();

    return createServerClient<Database>(resolvedUrl, resolvedKey, {
        auth: {
            debug: process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED
                ? process.env.NEXT_PUBLIC_SUPABASE_AUTH_DEBUG_ENABLED === 'true'
                : false,
        },
        cookies: {
            async getAll() {
                return await cookieStore.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
    });
}

export const fetchUserId = async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        throw new Error(`Auth error: ${error.message}`);
    }
    if (!data.user) {
        throw new Error('No authenticated user found');
    }
    return data.user.id;
};
