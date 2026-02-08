import { type NextRequest } from 'next/server';
// @ts-ignore
import { Pool } from 'pg';
import { fetchUserId } from '@/supabase/utils/server';

export async function GET(request: NextRequest) {
    let userId: string;
    try {
        userId = await fetchUserId();
    } catch (error) {
        console.error('refresh_token_check: auth failed:', error);
        return new Response(JSON.stringify({ result: false }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    if (!token) {
        return new Response(JSON.stringify({ result: false, error: 'token parameter required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const connectionString = process.env.SUPABASE_DATABASE_URL;
    const pool = new Pool({ connectionString });
    try {
        const result = await pool.query(
            'SELECT id from auth.refresh_tokens WHERE token=$1 AND user_id=$2',
            [token, userId]
        );
        return new Response(JSON.stringify({ result: (result.rowCount ?? 0) > 0 }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('refresh_token_check: query error:', error);
        return new Response(JSON.stringify({ result: false }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    } finally {
        await pool.end();
    }
}
