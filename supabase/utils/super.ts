import { Database } from '@/lib/database/types';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

export function createSuperClient() {
    const config = getSupabaseConfig();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!config || !serviceRoleKey) {
        throw new Error(
            'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
        );
    }

    return createClient<Database>(config.url, serviceRoleKey);
}
