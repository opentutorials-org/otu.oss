/**
 * Supabase 환경변수 설정 확인 유틸리티
 *
 * Vercel Deploy Button으로 배포할 때 Supabase Integration이 아직 연결되지 않으면
 * 환경변수가 미설정 상태일 수 있습니다. 이 경우 앱이 크래시하지 않도록
 * graceful하게 처리합니다.
 */

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        return null;
    }

    return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
    return getSupabaseConfig() !== null;
}

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
    'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.';
