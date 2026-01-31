import { swLogger } from '@/debug/sw';
import { openConfirmState, snackbarState } from '@/lib/jotai';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useCallback, useRef } from 'react';
import { openSnackbarState } from '@/lib/jotai';
import { captureException } from '@sentry/nextjs';

// requestIdleCallback 폴백 함수
const requestIdleCallbackPolyfill = (callback: IdleRequestCallback, options = {}) => {
    if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, options);
    }

    // 폴백: requestAnimationFrame + setTimeout 조합
    return requestAnimationFrame(() => {
        setTimeout(
            () =>
                callback({
                    didTimeout: false,
                    timeRemaining: () => 50, // 기본값 제공
                }),
            1
        );
    });
};

// 버전에 민감한 캐시 이름 목록 (앱 업데이트 시 삭제 필요)
const VERSION_SENSITIVE_CACHES = [
    'apis',
    'next-data',
    'pages-rsc',
    'pages-rsc-prefetch',
    'pages',
    'next-static-js-assets',
    'static-js-assets',
];

export default function useServiceWorkerReload() {
    const openSnackbar = useSetAtom(openSnackbarState);
    const [isCancelReloadRequest, setIsCancelReloadRequest] = useState(false);
    const [cacheBtnTaps, setCacheBtnTaps] = useState(0);
    const [lastTapTime, setLastTapTime] = useState(0);
    const lastFocusCheckTime = useRef<number>(0);
    const clearCacheInProgress = useRef<boolean>(false);
    const t = useTranslations();

    // 메시지 핸들러 함수를 useRef로 저장하여 재생성 방지
    const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);

    // 안전한 순차적 캐시 삭제 함수
    const clearCacheSafely = useCallback(async (cacheNames: string[]) => {
        if (clearCacheInProgress.current) {
            swLogger('이미 캐시 삭제가 진행 중입니다.');
            return false;
        }

        clearCacheInProgress.current = true;
        let i = 0;
        const total = cacheNames.length;

        return new Promise<boolean>((resolveAll) => {
            function processNextCache() {
                if (i >= total) {
                    clearCacheInProgress.current = false;
                    swLogger('모든 캐시 삭제 완료');
                    resolveAll(true);
                    return;
                }

                const cacheName = cacheNames[i++];

                swLogger(`캐시 삭제 시작: ${cacheName}`);
                caches
                    .delete(cacheName)
                    .catch((error) => {
                        swLogger(`캐시 삭제 오류 (${cacheName}):`, error);
                    })
                    .finally(() => {
                        // 진행상황 로깅 (10개마다)
                        if (i % 10 === 0 || i === total) {
                            swLogger(`캐시 삭제 진행: ${Math.round((i / total) * 100)}%`);
                        }

                        // 다음 캐시 삭제 스케줄링
                        scheduleNextCache();
                    });
            }

            function scheduleNextCache() {
                requestIdleCallbackPolyfill(
                    (deadline) => {
                        // 타임아웃이거나 최소 10ms의 여유 시간이 있을 경우에만 진행
                        if (deadline.didTimeout || deadline.timeRemaining() > 10) {
                            processNextCache();
                        } else {
                            // 시간이 부족하면 다시 스케줄링
                            scheduleNextCache();
                        }
                    },
                    { timeout: 1000 } // 최대 1초 후에는 강제 실행
                );
            }

            // 첫 번째 캐시 처리 시작
            scheduleNextCache();
        });
    }, []);

    // 캐시 삭제 기능을 별도 함수로 분리 (개선된 버전)
    const clearBrowserCache = useCallback(
        async (showNotification = true, clearAllCaches = false) => {
            swLogger('캐시 삭제를 시작합니다.');
            swLogger(`삭제 모드: ${clearAllCaches ? '전체 캐시 삭제' : '선택적 캐시 삭제'}`);

            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();

                    // 캐시가 없으면 바로 종료
                    if (cacheNames.length === 0) {
                        swLogger('삭제할 캐시가 없습니다.');
                        return true;
                    }

                    // 삭제할 캐시 필터링 (clearAllCaches가 true면 모든 캐시 삭제, 아니면 버전에 민감한 캐시만 삭제)
                    const cachesToDelete = clearAllCaches
                        ? cacheNames
                        : cacheNames.filter((name) =>
                              VERSION_SENSITIVE_CACHES.some((sensitive) => name.includes(sensitive))
                          );

                    if (cachesToDelete.length === 0) {
                        swLogger('삭제할 캐시가 없습니다.');
                        return true;
                    }

                    swLogger(
                        `총 ${cacheNames.length}개 캐시 중 ${cachesToDelete.length}개 삭제 예정`
                    );
                    swLogger(`삭제 대상 캐시: ${JSON.stringify(cachesToDelete)}`);

                    // 안전한 순차 삭제 실행
                    await clearCacheSafely(cachesToDelete);

                    if (showNotification && !isCancelReloadRequest) {
                        swLogger('Service Worker에 리로드 요청을 보냅니다.');
                        openSnackbar({
                            message: t('notice.update-so-reload'),
                            severity: 'info',
                            autoHideDuration: 30000,
                            horizontal: 'left',
                            vertical: 'bottom',
                            actionBtn: {
                                label: t('notice.refresh'),
                                onClick: () => {
                                    window.location.reload();
                                },
                            },
                        });
                    }
                    swLogger('캐시 삭제 완료');
                    return true;
                } catch (cacheError) {
                    swLogger('캐시 처리 중 오류가 발생했습니다:', cacheError);
                    captureException({
                        error: cacheError,
                        message:
                            '최신 버전으로 업그레이드 하기 위해서 캐시를 삭제 중 오류가 발생했습니다.',
                    });
                    return false;
                }
            }
            return false;
        },
        [isCancelReloadRequest, openSnackbar, t, clearCacheSafely]
    );

    // 캐시 버튼 탭 핸들러
    const handleCacheBtnTap = useCallback(() => {
        const now = Date.now();
        // 1초 이내의 탭만 연속 탭으로 인정
        if (now - lastTapTime < 1000) {
            setCacheBtnTaps((prev) => prev + 1);
        } else {
            setCacheBtnTaps(1);
        }
        setLastTapTime(now);
    }, [lastTapTime]);

    // 연속 탭 감지 및 캐시 삭제 실행
    useEffect(() => {
        if (cacheBtnTaps >= 5) {
            // 5번 연속 탭 시 캐시 삭제 실행 (전체 캐시 삭제)
            swLogger('캐시 버튼 5번 연속 탭 감지: 전체 캐시 삭제 시작');
            clearBrowserCache(true, true).then((success) => {
                if (success) {
                    swLogger('전체 캐시 삭제 완료');
                    openSnackbar({
                        message: t('notice.cache-cleared-manually'),
                        severity: 'success',
                        autoHideDuration: 3000,
                    });
                }
            });
            // 탭 카운트 초기화
            setCacheBtnTaps(0);
        }
    }, [cacheBtnTaps, clearBrowserCache, openSnackbar, t]);

    // 캐시 버튼에 클릭 이벤트 리스너 추가
    useEffect(() => {
        const setupCacheBtnTapListener = () => {
            const cacheBtn = document.getElementById('clear-cache-button');
            if (!cacheBtn) {
                // 버튼이 없으면 1초 후 다시 시도
                const timerId = setTimeout(() => {
                    setupCacheBtnTapListener();
                }, 1000);
                return () => clearTimeout(timerId);
            }

            swLogger('캐시 버튼에 클릭 이벤트 리스너 추가');
            cacheBtn.addEventListener('click', handleCacheBtnTap);

            return () => {
                try {
                    cacheBtn.removeEventListener('click', handleCacheBtnTap);
                } catch (error) {
                    console.error('캐시 버튼 이벤트 리스너 제거 중 오류가 발생했습니다:', error);
                }
            };
        };

        // DOM이 로드된 후 실행
        if (typeof window !== 'undefined') {
            const cleanup = setupCacheBtnTapListener();
            return cleanup;
        }
    }, [handleCacheBtnTap]);

    // Fetch the version from the server and compare with local commit_id
    const checkVersionAndUpdateCache = useCallback(
        async (source = 'scheduler') => {
            swLogger(`Service Worker 버전 체크를 시작합니다. (소스: ${source})`);

            try {
                // 오래된 캐쉬를 삭제하는 기능이 있어서 당분간 비활성화
                // if (process.env.NEXT_PUBLIC_PWA_DISABLED !== 'false') {
                //     swLogger('PWA가 비활성화되어 있습니다. 서버 버전 체크를 중지합니다.');
                //     return;
                // }

                // Check if we're online before making network requests
                if (!navigator.onLine) {
                    swLogger('오프라인 상태입니다. 서버 버전 체크를 중지합니다.');
                    return;
                }

                const response = await fetch('/api/check/version', {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store',
                        Pragma: 'no-cache',
                    },
                }).catch((error) => {
                    swLogger('버전 정보 요청 중 오류가 발생했습니다:', error);
                    return null;
                });

                if (!response) {
                    return;
                }

                const serverVersion = await response.text().catch((error) => {
                    swLogger('응답 텍스트 처리 중 오류가 발생했습니다:', error);
                    return null;
                });

                if (!serverVersion) {
                    return;
                }

                const localVersion = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown';

                if (serverVersion !== localVersion) {
                    swLogger('서버 버전이 다릅니다. 캐쉬를 삭제합니다.', {
                        serverVersion,
                        localVersion,
                    });
                    await clearBrowserCache(true, true);
                } else {
                    swLogger('서버 버전이 같습니다');
                }
            } catch (error) {
                swLogger('버전 체크 중 오류가 발생했습니다:', error);
            }
        },
        [clearBrowserCache]
    );

    // Schedule the version check (개선된 버전)
    const scheduleVersionCheck = useCallback(() => {
        try {
            // 처음 버전 체크는 20초 후에 실행하고, requestIdleCallback 사용
            setTimeout(() => {
                swLogger('초기 지연 후 버전 체크 예약');
                requestIdleCallbackPolyfill(
                    () => {
                        checkVersionAndUpdateCache('initial').catch((error) => {
                            swLogger('초기 버전 체크 실행 중 오류가 발생했습니다:', error);
                        });
                    },
                    { timeout: 10000 } // 최대 10초 후에는 강제 실행
                );
            }, 20000); // 20초 지연 (이전: 10ms)

            // 정기 체크는 그대로 유지하되 requestIdleCallback 사용
            setInterval(() => {
                requestIdleCallbackPolyfill(
                    () => {
                        checkVersionAndUpdateCache('interval').catch((error) => {
                            swLogger('주기적 버전 체크 중 오류가 발생했습니다:', error);
                        });
                    },
                    { timeout: 10000 }
                );
            }, 3600000); // Every 1 hour
        } catch (error) {
            swLogger('버전 체크 스케줄링 중 오류가 발생했습니다:', error);
        }
    }, [checkVersionAndUpdateCache]);

    useEffect(() => {
        scheduleVersionCheck();
    }, [scheduleVersionCheck]);

    // Service Worker 메시지 이벤트 처리 - 컴포넌트 첫 마운트 시에만 등록
    useEffect(() => {
        try {
            // 서비스 워커 지원 여부 및 navigator 객체 확인
            if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
                return;
            }

            // 메시지 핸들러를 useRef에 저장하여 항상 동일한 참조 유지
            if (!messageHandlerRef.current) {
                messageHandlerRef.current = (event: MessageEvent) => {
                    try {
                        swLogger('Service Worker로부터 메시지를 받았습니다:', event.data);
                        // 이벤트 처리 시에 현재 상태 확인
                        if (
                            event.data &&
                            event.data.type === 'RELOAD_REQUEST' &&
                            !isCancelReloadRequest
                        ) {
                            swLogger('Service Worker로부터 리로드 요청을 받았습니다.');
                            setIsCancelReloadRequest(true);
                            openSnackbar({
                                message: t('notice.update-so-reload'),
                                severity: 'info',
                                autoHideDuration: 30000,
                                horizontal: 'left',
                                vertical: 'bottom',
                                actionBtn: {
                                    label: t('notice.refresh'),
                                    onClick: () => {
                                        window.location.reload();
                                    },
                                },
                            });
                        }
                    } catch (innerError) {
                        swLogger('Service Worker 메시지 처리 중 오류가 발생했습니다:', innerError);
                        captureException({
                            error: innerError,
                            message: 'Service Worker 메시지 처리 중 오류가 발생했습니다.',
                        });
                    }
                };
            }

            swLogger('Service Worker에 message 이벤트 리스너를 등록합니다.');
            navigator.serviceWorker.addEventListener('message', messageHandlerRef.current);

            // 클린업 함수 반환 - 컴포넌트 언마운트 시에만 호출
            return () => {
                try {
                    if (messageHandlerRef.current) {
                        navigator.serviceWorker.removeEventListener(
                            'message',
                            messageHandlerRef.current
                        );
                        swLogger('Service Worker 이벤트 리스너 제거 완료');
                    }
                } catch (cleanupError) {
                    swLogger(
                        'Service Worker 이벤트 리스너 제거 중 오류가 발생했습니다:',
                        cleanupError
                    );
                    captureException({
                        error: cleanupError,
                        message: 'Service Worker 이벤트 리스너 제거 중 오류가 발생했습니다.',
                    });
                }
            };
        } catch (error) {
            swLogger('Service Worker 이벤트 리스너 설정 중 오류가 발생했습니다:', error);
            captureException({
                error: error,
                message: 'Service Worker 이벤트 리스너 설정 중 오류가 발생했습니다.',
            });
        }
    }, []); // 빈 의존성 배열로 컴포넌트 첫 마운트 시에만 실행

    // clearBrowserCache 함수를 반환하여 외부에서 사용할 수 있게 함
    return { clearBrowserCache };
}
