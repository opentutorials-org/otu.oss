import { useTranslations } from 'next-intl';
import {
    refreshSeedAfterContentUpdate,
    runSyncIdState,
    runSyncState,
    syncingState,
    contentListMessageState,
    syncResultState,
    openConfirmState,
    refreshListState,
    triggerSyncCompletedRefresh,
} from '@/lib/jotai';
import {
    count,
    pullOnlyOnline,
    pushOnlyOffline,
    verifyByCount,
    verifyByLast,
    verifyStrong,
} from '@/watermelondb/control/Page';
import { sync, SyncResult } from '@/watermelondb/sync';
import { useAtomValue, useSetAtom } from 'jotai';
import debounce from 'lodash/debounce';
import { useCallback, useEffect, useRef } from 'react';
import { syncLogger } from '@/debug/sync';
import { createClient } from '@/supabase/utils/client';
import { clearOnlyWatermelonDB, clearStorage } from '../clearStorage';
import { SESSION_USER_ID_FOR_CHECK_SYNC } from '../constants';
import { getCookie } from '../cookie';
import { redirect } from 'next/navigation';

export const useSync = () => {
    const t = useTranslations();
    const refreshList = useSetAtom(refreshListState);
    const setSyncing = useSetAtom(syncingState);
    const runSync = useSetAtom(runSyncState);
    const runSyncId = useAtomValue(runSyncIdState);
    const syncResult = useSetAtom(syncResultState);
    const isFirstSyncCompleted = useRef(false);
    const setContentListMessage = useSetAtom(contentListMessageState);
    const openConfirm = useSetAtom(openConfirmState);
    const isSyncingRef = useRef(false);
    const triggerSyncRefresh = useSetAtom(triggerSyncCompletedRefresh);

    // 동시 이벤트 발생 시 중복 호출 방지를 위한 debounced runSync
    const debouncedRunSync = useRef(
        debounce(
            () => {
                runSync({});
            },
            2000,
            { leading: true, trailing: true }
        ) // 2초 이내의 중복 호출: 최초 1회 즉시 실행 + 마지막 1회 2초 후 실행
    ).current;

    const checkSessionExpiration = async () => {
        syncLogger('checkSessionExpiration start');
        const supabase = createClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        syncLogger('checkSessionExpiration', { sessionData: data, sessionError });
        let user_id = null;
        if (data.session === null) {
            const parseCookies = (cookieString: string) => {
                return cookieString
                    .split(';')
                    .map((cookie) => cookie.trim())
                    .reduce((acc, cookie) => {
                        const [name, value] = cookie.split('=');
                        // @ts-ignore
                        acc[name] = decodeURIComponent(value);
                        return acc;
                    }, {});
            };
            const cookies = parseCookies(document.cookie);
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userData.user === null) {
                syncLogger('예상치 못한 로그아웃 문제 원인 파악을 위한 로그', {
                    sessionError,
                    userData,
                    userError,
                    cookies,
                });
                await supabase.auth.signOut({ scope: 'global' });
                await clearStorage(
                    'checkSessionExpiration에서 getUser의 값이 null이기 때문에 로그아웃'
                );
                throw new Error('세션이 만료 되었습니다');
            }
            user_id = userData.user.id;
        } else {
            user_id = data.session.user.id;
        }
        const sessionCheckFlag = getCookie(SESSION_USER_ID_FOR_CHECK_SYNC);
        if (sessionCheckFlag !== user_id) {
            syncLogger(
                'SESSION_USER_ID_FOR_CHECK_SYNC 불일치가 분 이 값이 불일치하면 다른 사용자의 데이터가 남아있을 수 있기 때문에 안전을 위해서 로그아웃합니다.',
                {
                    SESSION_USER_ID_FOR_CHECK_SYNC,
                    'data.session.user.id': user_id,
                }
            );
            await supabase.auth.signOut({ scope: 'global' });
            await clearStorage(
                `로그인 된 사용자(${user_id})와 SESSION_USER_ID_FOR_CHECK_SYNC(${SESSION_USER_ID_FOR_CHECK_SYNC}) 값이 다름`
            );
            redirect('/welcome');
        }
    };

    useEffect(() => {
        if (runSyncId) {
            (async () => {
                try {
                    syncLogger('runSync start');
                    // await checkSessionExpiration();
                    await performSync();
                } catch (error) {
                    console.error(error);
                }
            })();
        }
    }, [runSyncId]);

    useEffect(() => {
        const goOnline = () => {
            debouncedRunSync();
        };
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('online', goOnline);
        };
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                debouncedRunSync();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const inTab = () => {
            debouncedRunSync();
        };
        window.addEventListener('focus', inTab);
        return () => {
            window.removeEventListener('focus', inTab);
        };
    }, []);

    useEffect(() => {
        const interval = setInterval(
            () => {
                runSync({});
            },
            1000 * 60 * 30
        );

        // cleanup: 컴포넌트 언마운트 시 인터벌 제거
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        setTimeout(() => {
            runSync({});
        }, 1);
    }, []);

    type failOverResultType = {
        offlineTotal: number;
        onlineTotal: number;
        onlyOfflineIds: string[];
        onlyOnlineIds: string[];
    };
    // 테스트 할 때 only local과 only remote를 동수로 하면 verify에서 걸러지지 못하기 때문에 주의가 필요함.
    const failOver = async ({
        offlineTotal,
        onlineTotal,
        onlyOfflineIds,
        onlyOnlineIds,
    }: failOverResultType) => {
        if (onlyOfflineIds.length > 0) {
            await pushOnlyOffline(onlyOfflineIds);
        }
        if (onlyOnlineIds.length > 0) {
            await pullOnlyOnline(onlyOnlineIds);
        }
    };
    type checkSyncResultType = {
        isSuccess: boolean;
        data?: any;
    };

    const checkSync = async (): Promise<checkSyncResultType> => {
        try {
            // 두 검증을 병렬로 실행 (옵션)
            const [verifyLastResult, verifyCountResult] = await Promise.all([
                verifyByLast(),
                verifyByCount(),
            ]);

            syncLogger('light sync verify by last', verifyLastResult);
            syncLogger('light sync verify by count', verifyCountResult);

            if (!verifyLastResult.isEqual || !verifyCountResult.isEqual) {
                const verifyStrongResult = await verifyStrong();
                syncLogger('strong sync verify after last or count check', verifyStrongResult);
                return { isSuccess: false, data: verifyStrongResult };
            }

            return { isSuccess: true };
        } catch (error) {
            syncLogger('Error during synchronization check', error);
            console.error('Sync check error:', error);
            // 필요한 경우, 강력한 검증을 수행하거나, 실패를 반환할 수 있습니다.
            // @ts-ignore
            return { isSuccess: false, data: { error: error.message } };
        }
    };

    const performSync = useCallback(async (isReset?: boolean) => {
        // Race condition 방지: 체크와 설정을 원자적으로 수행
        if (isSyncingRef.current) {
            syncLogger('동기화가 이미 진행 중이므로 요청을 무시합니다.');
            return;
        }

        // 즉시 락 설정 (다른 호출이 if문을 통과하기 전에)
        isSyncingRef.current = true;

        syncLogger('sync start (performSync)');

        let result: SyncResult | null = null;
        setSyncing(true);
        // 최초 동기화인지 확인하기 위한 변수
        let isFirstInitialSync = false;

        try {
            result = await sync(isReset, ({ name, progress, isInitialSync }) => {
                if (name === 'pull_progress')
                    setContentListMessage(
                        t.markup('migration.sync', {
                            br: () => '<br />',
                            progress: progress ?? 0,
                        })
                    );
                if (name === 'pull_progress' && isInitialSync) {
                    refreshList({
                        source: 'functions/hooks/useSync:performSync-progress',
                    });
                }

                if (name === 'end') {
                    setContentListMessage('');
                    // 최초 동기화 여부 저장
                    isFirstInitialSync = isInitialSync || false;
                }
            });
            if (result && result.pullCount > 0 && !isFirstInitialSync) {
                syncLogger(
                    `${result.pullCount}개의 데이터를 가져왔기 때문에 즉시+1초 후 refreshList를 호출해서 레이아웃을 랜더링 함.`
                );
                // 일반 동기화 후 글목록 갱신을 즉시+1초 후 실행
                refreshList({
                    source: 'functions/hooks/useSync:performSync',
                });
                // sync 완료 시 컨텐츠 리프레시 트리거
                triggerSyncRefresh(`functions/hooks/useSync:performSync-${Date.now()}`);
            } else if (result && result.pullCount > 0 && isFirstInitialSync) {
                syncLogger(
                    `최초 동기화 중(${isFirstInitialSync})에는 ${result.pullCount}개의 데이터를 가져왔지만 글 목록 갱신하지 않음.`
                );
            }
            if (result) {
                syncResult(result);
            }

            if (isFirstSyncCompleted.current === false) {
                const pageCount = await count();
                if (pageCount === 0) {
                    setContentListMessage('Hello, World!');
                } else {
                    const checkSyncResult1 = await checkSync();
                    if (checkSyncResult1.isSuccess === false) {
                        await failOver(checkSyncResult1.data!);
                        const checkSyncResult2 = await checkSync();
                        if (checkSyncResult2.isSuccess === true) {
                            syncLogger('file over success');
                            console.error(
                                '[Sync] failover 후 동기화 검증 성공. 온라인/오프라인 데이터 불일치가 있었으나 복구됨.',
                                { checkSyncResult2 }
                            );
                            refreshList({
                                source: 'functions/hooks/useSync:performSync',
                            });
                        } else {
                            syncLogger('동기화 오류 교정 후에 재검증 결과', checkSyncResult2);
                        }
                    } else {
                        if (isFirstInitialSync) {
                            // 동기화가 끝났음을 알리고 시작하기 버튼을 제공해서 클릭하면 리로드 되도록 처리
                            syncLogger(`최초 동기화 완료 - 즉시+1초 후 리로드 시작`);
                            // 최초 동기화 완료 후 글목록 갱신을 즉시+1초 후 실행
                            refreshList({
                                source: 'functions/hooks/useSync:performSync-firstSync',
                            });
                            // 최초 sync 완료 시 컨텐츠 리프레시 트리거
                            triggerSyncRefresh(
                                `functions/hooks/useSync:performSync-firstSync-${Date.now()}`
                            );
                        }
                    }
                }
                isFirstSyncCompleted.current = true;
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSyncing(false);
            isSyncingRef.current = false; // 중복 실행 방지 플래그 해제
        }

        return result;
    }, []);
};
