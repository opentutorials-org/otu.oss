'use client';

import { useSync } from '@/functions/hooks/useSync';
import { useCheckHomeAuth } from '@/components/core/Auth';
import { useEffect, useState, useRef } from 'react';
import { captureException } from '@sentry/nextjs';
import { createClient } from '@/supabase/utils/client';
import dynamic from 'next/dynamic';
import { renderLogger } from '@/debug/render';
import { enhancedRenderLogger } from '@/debug/render';
import { useLocale } from 'next-intl';
import useServiceWorkerReload from '@/functions/hooks/useServiceWorkerReload';
import useCheckWatermelondb from '@/functions/hooks/useCheckWatermelondb';
import { useDeepLinkWebView } from '@/functions/hooks/useDeepLinkWebView';
import { syncLogger } from '@/debug/sync';
import { database } from '@/watermelondb';
import { runSyncState } from '@/lib/jotai';
import { useSetAtom } from 'jotai';
import { usePathname } from 'next/navigation';
import { navPageLogger } from '@/debug/nav';
import FileUploaderLoader from '@/components/home/logined/fileUploader/loader';
// Chat/UI/Setting은 ClientRouter 내부로 이동
import { useFoldersData } from '@/hooks/useFoldersData';

// ClientRouter를 동적으로 로드하여 SSR 에러 방지
const ClientRouter = dynamic(() => import('@/components/home2/router/ClientRouter'), {
    ssr: false,
});

export default function Layout({ children }: { children: React.ReactNode }) {
    renderLogger('root/(ui)/home/layout.tsx');
    // 데이터베이스 초기화 상태 추적
    const dbInitialized = useRef(false);
    const [isDbReady, setIsDbReady] = useState(false);
    const runSync = useSetAtom(runSyncState);
    const pathname = usePathname();

    // 폴더 데이터 초기화
    useFoldersData();

    enhancedRenderLogger('Layout', {
        isDbReady,
        dbInitialized: dbInitialized.current,
    });

    // WatermelonDB 초기화를 먼저 실행
    useCheckWatermelondb();

    // 데이터베이스 준비 확인
    useEffect(() => {
        const checkDb = async () => {
            try {
                // 데이터베이스 연결 확인
                const startTime = performance.now();
                syncLogger('데이터베이스 초기화 시작');

                if (!database.adapter) {
                    throw new Error('Database adapter is not initialized');
                }

                // 데이터베이스에 접근 가능한지 확인
                // collections 속성에 map을 직접 호출하는 대신 다른 방식으로 접근
                const collections = Object.keys(database.collections.map);
                syncLogger('사용 가능한 컬렉션:', collections);

                const endTime = performance.now();
                syncLogger(`데이터베이스 초기화 완료 (${(endTime - startTime).toFixed(2)}ms)`);

                dbInitialized.current = true;
                setIsDbReady(true);
            } catch (error) {
                captureException(error);
                console.error('데이터베이스 초기화 오류:', error);
                // 오류가 발생해도 앱은 계속 진행
                setIsDbReady(true);
            }
        };

        checkDb();
    }, []);

    // 다른 훅들은 데이터베이스 준비 후 실행
    useCheckHomeAuth();
    useSync();
    useServiceWorkerReload();

    // 라우트 진입 시점에서 동기화 트리거 (페이지/폴더/리마인더)
    useEffect(
        function triggerSyncOnRouteEnter() {
            if (!pathname) return;
            if (
                pathname.startsWith('/home/page/') ||
                pathname === '/home/folder' ||
                pathname.startsWith('/home/folder/') ||
                pathname === '/home/reminder'
            ) {
                navPageLogger(`enter ${pathname} → trigger runSync (layout)`);
                runSync({});
            }
        },
        [pathname, runSync]
    );

    const locale = useLocale();

    useEffect(() => {
        (async () => {
            const [{ termsOfService }, { privacyPolicy }, { marketing }] = await Promise.all([
                import(
                    `@/components/layout/bottom/agreement/docs/${locale}/terms-of-service_2024_6_20`
                ),
                import(
                    `@/components/layout/bottom/agreement/docs/${locale}/privacy-policy_2024_6_20`
                ),
                import(`@/components/layout/bottom/agreement/docs/${locale}/marketing_2024_6_20`),
            ]);

            // @ts-ignore
            const supabase = createClient();

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user?.user_metadata.terms_of_service_consent_version) {
                await supabase.auth.updateUser({
                    data: {
                        terms_of_service_consent_version: termsOfService.version,
                        terms_of_service_consent_updated_at: new Date().toISOString(),
                    },
                });
            }

            if (!user?.user_metadata.privacy_policy_consent_version) {
                await supabase.auth.updateUser({
                    data: {
                        privacy_policy_consent_version: privacyPolicy.version,
                        privacy_policy_consent_updated_at: new Date().toISOString(),
                    },
                });
            }
        })();
    }, [locale]);

    return (
        <>
            {/* {children} */}
            {/* <LightBox /> */}
            <ClientRouter />
        </>
    );
}
