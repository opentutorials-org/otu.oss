import { createClient } from '@/supabase/utils/server';

export const requireLogin = async () => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    // @ts-ignore
    if (!user || !user.id) {
        throw new Error('로그인이 필요합니다');
    } else {
        return user.id;
    }
};
