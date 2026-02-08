import { type NextRequest } from 'next/server';
// @ts-ignore
import { Pool } from 'pg';
import { fetchUserId } from '@/supabase/utils/server';

export async function GET(request: NextRequest) {
    let userId: string;
    try {
        userId = await fetchUserId();
    } catch {
        return new Response(JSON.stringify({ result: false }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const searchParams = request.nextUrl.searchParams;
    const connectionString = process.env.SUPABASE_DATABASE_URL;
    const pool = new Pool({ connectionString });
    try {
        const result = await pool.query(
            'SELECT * from auth.refresh_tokens WHERE token=$1 AND user_id=$2',
            [searchParams.get('token'), userId]
        );
        return new Response(JSON.stringify({ result: result.rows }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } finally {
        await pool.end();
    }
}
