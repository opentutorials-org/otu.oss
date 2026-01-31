// services/usageService.ts
// 결제 기능 제거됨 - 오픈소스 버전에서는 사용자가 자신의 API 키를 사용
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database/types';
import { usageLogger } from '@/debug/usage';
import { fetchUserId } from '@/supabase/utils/client';
import { addUsageRecordIfNotExists } from './addUsageRecordIfNotExists';

export class UsageService {
    private supabase: SupabaseClient<Database>;
    private requestId?: string;

    constructor(supabaseClient: any, requestId: string = '') {
        this.supabase = supabaseClient;
        this.requestId = requestId;
    }

    /**
     * 사용량 정보 가져오기
     */
    async fetchUsage(): Promise<Database['public']['Tables']['usage']['Row']> {
        usageLogger(this.requestId, '사용량 정보 가져오기 시작');

        const user_id = await fetchUserId();
        let { data: usageArray, error } = await this.supabase
            .from('usage')
            .select('*')
            .eq('user_id', user_id);
        usageLogger(this.requestId, '사용량 정보 가져옴', { usageArray });

        if (error) {
            usageLogger(this.requestId, '사용량 정보를 가져오는 중 오류가 발생했습니다.', {
                error,
            });
            throw new Error('사용량 정보를 가져오는데 실패했습니다.', { cause: error });
        }

        if (!usageArray || usageArray.length === 0) {
            usageLogger(this.requestId, 'usage가 존재하지 않아서 생성을 시도합니다.');
            await addUsageRecordIfNotExists(this.supabase);
            const { data: _usageArray, error: _error } = await this.supabase
                .from('usage')
                .select('*')
                .eq('user_id', user_id);
            if (_error) {
                throw new Error('사용량 정보를 가져오는데 실패했습니다.', { cause: _error });
            }
            usageArray = _usageArray;
        }

        const usage = usageArray ? usageArray[0] : null;

        if (!usage) {
            usageLogger(this.requestId, '사용량 데이터를 찾을 수 없습니다.');
            throw new Error('사용량 정보를 찾을 수 없습니다.', { cause: 'NO_DATA' });
        }

        usageLogger(this.requestId, '사용량 정보를 성공적으로 가져왔습니다.', { usage });
        return usage;
    }

    /**
     * 주어진 userId의 currentUsage를 가져오는 메소드
     * @param userId - 사용자 ID
     * @returns 사용자의 currentUsage 데이터
     */
    async get(userId: string): Promise<Database['public']['Tables']['usage']['Row']> {
        usageLogger(this.requestId, `사용자 ${userId}의 currentUsage 정보를 가져오는 중`);
        const { data: usageArray, error } = await this.supabase
            .from('usage')
            .select('*')
            .eq('user_id', userId);
        if (error) {
            usageLogger(this.requestId, `사용자 ${userId}의 currentUsage 정보 가져오기 실패`, {
                error,
            });
            throw new Error('currentUsage 정보를 가져오는데 실패했습니다.', { cause: error });
        }
        const usage = usageArray ? usageArray[0] : null;
        if (!usage) {
            usageLogger(this.requestId, `사용자 ${userId}의 currentUsage 데이터 없음`);
            throw new Error('currentUsage 정보를 찾을 수 없습니다.', { cause: 'NO_DATA' });
        }
        usageLogger(this.requestId, `사용자 ${userId}의 currentUsage 정보 가져오기 성공`, {
            usage,
        });
        return usage;
    }
}
