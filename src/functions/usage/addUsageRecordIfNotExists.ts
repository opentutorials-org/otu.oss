import { SupabaseClient } from '@supabase/supabase-js';
import { usageLogger } from '@/debug/usage';

export async function addUsageRecordIfNotExists(supabase: SupabaseClient): Promise<boolean> {
    // 1. 행이 존재하는지 확인
    const { data: existingData, error: selectError } = await supabase.from('usage').select('*');

    if (existingData && existingData.length > 0) {
        usageLogger('Usage record already exists:', existingData);
        return false; // 이미 행이 존재하면 false 반환 (기존 사용자)
    }

    // 2. 존재하지 않으면 새로운 행 추가
    const { data, error } = await supabase.from('usage').insert([
        {
            status: 'ACTIVE', // 사용 중인 subscription_status enum 값에 맞게 수정
            plan_type: 'FREE', // 사용 중인 subscription_plan enum 값에 맞게 수정
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
        },
    ]);

    if (error) {
        console.error('Error adding usage record:', error);
        return false;
    } else {
        usageLogger('Added usage record:', data);
        return true; // 새로 생성되었으므로 true 반환 (신규 사용자)
    }
}
