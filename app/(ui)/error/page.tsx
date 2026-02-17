'use client';

import Button from '@mui/material/Button';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/supabase/utils/client';
import { useRouter } from 'next/navigation';
import { clearStorage } from '@/functions/storage/clearStorage';

import { useLingui } from '@lingui/react/macro';

export default function Error() {
    const { t } = useLingui();
    const router = useRouter();
    const supabase = createClient();
    const searchParams = useSearchParams();

    // URL 파라미터에서 error 코드 가져오기 → 다국어 메시지 매핑
    const errorParam = searchParams.get('error');
    const errorMessages: Record<string, string> = {
        social_login_failed: t`소셜 로그인에 실패했습니다. 다시 시도해주세요.`,
    };
    const errorMessage = errorParam ? (errorMessages[errorParam] ?? t`오류가 발생했습니다.`) : null;

    // 사용자 로그인 상태 확인
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const checkLoginStatus = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            setIsLoggedIn(!!session);
        };
        checkLoginStatus();
    }, [supabase]);

    // 다시시도 버튼 핸들러
    const handleRetry = useCallback(() => {
        window.location.reload();
    }, []);

    // 로그아웃 버튼 핸들러
    const handleLogout = useCallback(async () => {
        try {
            // Supabase 로그아웃
            await supabase.auth.signOut({ scope: 'local' });

            // 스토리지 정리
            await clearStorage('로그아웃 중...');

            // 로그인 페이지로 리다이렉트
            setTimeout(() => {
                window.location.href = '/welcome';
            }, 500);
        } catch (error) {
            console.error('로그아웃 중 오류 발생:', error);
            // 오류가 발생해도 강제로 리다이렉트
            setTimeout(() => {
                window.location.href = '/welcome';
            }, 500);
        }
    }, [supabase, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-3xl font-bold mb-10">{t`앗!`}</h1>
            <h2 className="text-lg mb-10">{errorMessage ?? t`오류가 발생했습니다.`}</h2>

            <div className="flex flex-col gap-2 w-full max-w-[200px]">
                <Button variant="contained" onClick={handleRetry}>
                    {t`다시시도`}
                </Button>

                {isLoggedIn && (
                    <Button variant="contained" onClick={handleLogout}>
                        {t`로그아웃`}
                    </Button>
                )}
            </div>
        </div>
    );
}
