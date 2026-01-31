import { Database } from '@/lib/database/types';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient(
    url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
) {
    const cookieStore = await cookies();

    return createServerClient<Database>(url, key, {
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
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
            throw new Error(`Session error: ${sessionError.message}`);
        }
        if (!sessionData.session) {
            throw new Error('No active session found');
        }
        if (!sessionData.session.user) {
            throw new Error('No user associated with the session');
        }
        const userId = sessionData.session.user.id;
        return userId;
    } catch (error) {
        throw error;
    }
};
