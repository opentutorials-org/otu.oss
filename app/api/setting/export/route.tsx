// db.js
import errorResponse, { successResponse } from '@/functions/api/response';
import { createClient } from '@/supabase/utils/server';
import { cookies } from 'next/headers';
import { getServerI18n } from '@/lib/lingui';
import { msg } from '@lingui/core/macro';
import { parseLocaleFromAcceptLanguage } from '@/functions/constants';
// export const runtime = "edge";

export async function GET(req: Request) {
    const locale = parseLocaleFromAcceptLanguage(req.headers.get('accept-language'));
    const i18n = await getServerI18n(locale);
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    // @ts-ignore
    if (!user || !user.id) {
        return errorResponse(
            {
                status: 500,
                errorCode: 'NO_USER_INFO',
                data: {},
                meta: {},
                message: i18n._(msg`로그인이 필요합니다. 사용자 정보를 찾지 못했습니다.`),
            },
            new Error()
        );
    }

    let user_id = user.id;

    const EXPORT_LIMIT = 5000;
    const { data: page, error } = await supabase
        .from('page')
        .select('id, title, body, is_public, last_viewed_at, created_at, updated_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: true })
        .limit(EXPORT_LIMIT);

    if (error) {
        return errorResponse(
            {
                status: 500,
                errorCode: 'DATABASE_ERROR',
                data: {},
                meta: {},
                message: i18n._(msg`데이터를 가져오는 중 오류가 발생했습니다.`),
            },
            error
        );
    }

    const pages = page ?? [];
    const isTruncated = pages.length >= EXPORT_LIMIT;

    return successResponse({
        message: 'success',
        data: pages,
        meta: {
            ...(isTruncated && {
                warning: i18n._(msg`내보내기가 ${EXPORT_LIMIT}페이지로 제한되었습니다.`),
            }),
        },
    });
}
