// This hook initializes or destroys eruda based on the value of localStorage.OTU_debug.
import { captureException } from '@sentry/nextjs';
import { useEffect, useRef } from 'react';

// eruda 타입 선언
declare global {
    interface Window {
        eruda: any;
        Stats: any;
    }
}

// stats.js 설정 및 초기화 함수 (동적 로딩)
const setupStats = async () => {
    // stats.js가 이미 로드되어 있는지 확인
    if (!window.Stats) {
        // CDN에서 stats.js 동적 로드
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.id = 'stats-script';
            script.src = 'https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load stats.js'));
            document.head.appendChild(script);
        });
    }

    const Stats = window.Stats;

    // FPS 패널
    const fpsStats = new Stats();
    fpsStats.showPanel(0); // 0: FPS
    fpsStats.dom.style.cssText = 'position:fixed;top:0;left:0;';

    // MS 패널 (렌더링 시간)
    const msStats = new Stats();
    msStats.showPanel(1); // 1: MS
    msStats.dom.style.cssText = 'position:fixed;top:0;left:80px;';

    // 메모리 패널
    const memStats = new Stats();
    memStats.showPanel(2); // 2: MB
    memStats.dom.style.cssText = 'position:fixed;top:0;left:160px;';

    // 패널들을 body에 추가
    const addStatsToDOM = () => {
        document.body.appendChild(fpsStats.dom);
        document.body.appendChild(msStats.dom);
        document.body.appendChild(memStats.dom);
    };

    // 패널들을 DOM에서 제거
    const removeStatsFromDOM = () => {
        if (document.body.contains(fpsStats.dom)) {
            document.body.removeChild(fpsStats.dom);
        }
        if (document.body.contains(msStats.dom)) {
            document.body.removeChild(msStats.dom);
        }
        if (document.body.contains(memStats.dom)) {
            document.body.removeChild(memStats.dom);
        }
    };

    // 애니메이션 프레임 ID
    let animationFrameId: number;

    // stats 업데이트 함수
    const updateStats = () => {
        fpsStats.update();
        msStats.update();
        memStats.update();
        animationFrameId = requestAnimationFrame(updateStats);
    };

    // stats 시작
    const startStats = () => {
        addStatsToDOM();
        animationFrameId = requestAnimationFrame(updateStats);
    };

    // stats 중지
    const stopStats = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        removeStatsFromDOM();
    };

    return {
        start: startStats,
        stop: stopStats,
    };
};

const useEruda = () => {
    const isErudaInjected = useRef(false);
    const statsMonitor = useRef<{ start: () => void; stop: () => void } | null>(null);

    useEffect(() => {
        const isDebugMode = localStorage.getItem('OTU_debug') === 'true';

        const injectEruda = () => {
            const script = document.createElement('script');
            script.id = 'eruda-script';
            script.src = 'https://cdn.jsdelivr.net/npm/eruda';
            // @ts-ignore
            script.onload = async () => {
                window.eruda.init();

                // stats.js 모니터 초기화 및 시작 (동적 로딩)
                if (!statsMonitor.current) {
                    try {
                        statsMonitor.current = await setupStats();
                        statsMonitor.current.start();
                    } catch (error) {
                        console.error('Failed to load stats.js:', error);
                        captureException(error);
                    }
                } else {
                    statsMonitor.current.start();
                }
            };
            document.body.appendChild(script);
            isErudaInjected.current = true;
        };

        const removeEruda = () => {
            if (window.eruda && window.eruda.destroy) {
                window.eruda.destroy();
                const script = document.getElementById('eruda-script');
                if (script) {
                    document.body.removeChild(script);
                }
                isErudaInjected.current = false;

                // stats.js 모니터 중지
                if (statsMonitor.current) {
                    statsMonitor.current.stop();
                }
            }
        };
        try {
            if (isDebugMode) {
                if (!isErudaInjected.current) {
                    injectEruda();
                }
            } else {
                removeEruda();
            }
        } catch (e) {
            captureException(e);
        }

        // 컴포넌트 언마운트 시 정리
        return () => {
            if (statsMonitor.current) {
                statsMonitor.current.stop();
            }
        };
    }, []);
};

export default useEruda;
