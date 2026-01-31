import { Database } from '@/lib/database/types';
import { authLogger } from '@/debug/auth';
import { fetchUserId } from '@/supabase/utils/server';
import { addBreadcrumb, captureMessage } from '@sentry/nextjs';
import { SupabaseClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

export async function getUsage(
    supabase: SupabaseClient
): Promise<Database['public']['Tables']['usage']['Row']> {
    addBreadcrumb({
        category: 'usage',
        message: 'usage 정보를 가져오는 중',
        level: 'fatal',
    });

    const user_id = await fetchUserId();
    const { data: usageArray, error } = await supabase
        .from('usage')
        .select('*')
        .eq('user_id', user_id);

    addBreadcrumb({
        category: 'usage',
        message: 'usage 정보를 가져옴',
        data: {
            usageArray,
            error,
        },
        level: 'fatal',
    });

    const usage = usageArray ? usageArray[0] : null;

    if (!usage || error) {
        addBreadcrumb({
            category: 'usage',
            message: 'usage 정보를 가져오지 못했습니다',
            data: {
                usage,
                error,
            },
        });
        authLogger('getUsage', 'usage 정보를 가져오지 못했습니다.');
        throw new Error('사용량 정보를 가져오는데 실패했습니다. ', {
            cause: 'NO_DATA',
        });
    }

    if (
        ['INACTIVE_FREE_USAGE_EXCEEDED', 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED'].includes(
            usage.status
        )
    ) {
        const now = dayjs();
        const nextResetDate = dayjs(usage.next_reset_date);
        const daysRemaining = nextResetDate.diff(now, 'day');

        const error = new Error('MONTHLY_USAGE_EXCEEDED');
        // @ts-ignore
        error.cause = {
            code: usage.status,
            data: {
                resetDate: nextResetDate.format('YYYY년 MM월 DD일'),
                daysRemaining: daysRemaining.toString(),
            },
        };
        throw error;
    }

    if ('INACTIVE_EXPIRED_AUTO_RENEW_FAIL' === usage.status) {
        const error = new Error('SUBSCRIPTION_RENEWAL_FAILED');
        // @ts-ignore
        error.cause = { code: usage.status };
        throw error;
    }

    return usage;
}
