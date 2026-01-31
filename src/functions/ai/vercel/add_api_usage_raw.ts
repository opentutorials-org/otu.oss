import { Client, Pool, PoolClient } from 'pg';
import { usageLogger } from '@/debug/usage';
import { FREE_PLAN_USAGE_LIMIT, SUBSCRIPTION_USAGE_LIMIT } from '@/functions/constants';
import { Database } from '@/lib/database/types';

const updateUsageStatus = async (
    client: PoolClient,
    user_id: string,
    updates: Partial<Omit<Database['public']['Tables']['usage']['Row'], 'user_id'>>
) => {
    const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
    const values = [user_id, ...Object.values(updates)];
    const query = `UPDATE usage SET ${setClause} WHERE user_id = $1 RETURNING *`;

    try {
        const res = await client.query(query, values);
        if (res.rows.length === 0) {
            usageLogger('사용자 사용량 정보를 업데이트하지 못했습니다.', { data: res.rows });
            throw new Error('사용자 사용량 정보를 업데이트하지 못했습니다.');
        }
        usageLogger('사용자 사용량 정보가 업데이트 되었습니다.', { updates });
    } catch (error) {
        usageLogger('사용자 사용량 정보를 업데이트하지 못했습니다.', { error });
        throw new Error('사용자 사용량 정보를 업데이트하지 못했습니다.');
    }
};

export async function add_api_usage_raw(
    dataArray: Array<{
        api_type_id: number;
        amount: number;
        total_cost: number; // price 필드 추가
        usage_purpose: number;
        created_at?: string | undefined;
    }>,
    user_id: string
) {
    usageLogger('사용량 정보를 업데이트합니다.', { dataArray });
    const connectionString = process.env.SUPABASE_DATABASE_URL;
    const pool = new Pool({ connectionString });
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // 트랜잭션 시작

        const usageQuery = 'SELECT * FROM usage WHERE user_id = $1 FOR UPDATE';
        const usageRes = await client.query(usageQuery, [user_id]);
        if (usageRes.rows.length === 0) {
            usageLogger('usage 정보를 가져오지 못했습니다.', { usageData: usageRes.rows });
            throw new Error('usage 정보를 가져오지 못했습니다.');
        }
        const usageData = usageRes.rows[0];
        let current_quota = Number(usageData.current_quota === null ? 0 : usageData.current_quota);

        for (const data of dataArray) {
            usageLogger('사용량을 더합니다', {
                current_quota: current_quota,
                call_price: data.total_cost,
            });
            current_quota += data.total_cost;
        }

        const plan_type = usageData.plan_type;
        if (plan_type === 'FREE' && current_quota > FREE_PLAN_USAGE_LIMIT) {
            usageLogger('무료 사용자의 사용량이 초과되었습니다.', { current_quota });
            await updateUsageStatus(client, user_id, {
                status: 'INACTIVE_FREE_USAGE_EXCEEDED',
                current_quota,
            });
        } else if (
            ['MONTHLY', 'YEARLY'].includes(plan_type) &&
            current_quota > SUBSCRIPTION_USAGE_LIMIT
        ) {
            usageLogger('유료 사용자의 사용량이 초과되었습니다.', { current_quota });
            await updateUsageStatus(client, user_id, {
                status: 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED',
                current_quota,
            });
        } else {
            usageLogger('사용량이 업데이트 되었습니다.', { current_quota });
            await updateUsageStatus(client, user_id, { current_quota });
        }

        await client.query('COMMIT'); // 트랜잭션 커밋
    } catch (error) {
        await client.query('ROLLBACK'); // 오류 발생 시 롤백
        usageLogger('사용량 정보를 업데이트하는 중 오류가 발생했습니다.', { error });
        throw new Error('사용량 정보를 업데이트하는 중 오류가 발생했습니다.');
    } finally {
        client.release();
    }
}
