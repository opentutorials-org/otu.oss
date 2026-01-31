'use client';
import { createClient } from '@/supabase/utils/client';

export async function runEmbedding() {
    try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user?.id) {
            const userId = data.session.user.id;
            const response = await fetch(`/api/ai/embedding-user?user_id=${userId}`);

            if (!response.ok) {
                // HTTP 오류는 서버 측에서 센트리로 전송하므로 여기서는 로그만 남김
                console.error(`Embedding API responded with status: ${response.status}`);
                return false;
            }

            return true;
        }
        return false;
    } catch (error) {
        // 네트워크 오류만 콘솔에 기록
        console.error('Embedding API fetch failed:', error);
        return false;
    }
}
