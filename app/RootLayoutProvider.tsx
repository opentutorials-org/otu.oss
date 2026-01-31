'use client';
import { useAtom } from 'jotai';
import React, { useEffect, useState } from 'react';
import { themeModeState } from '@/lib/jotai';
import { themeLogger } from '@/debug/theme';

/**
 * 테마 관리 로직:
 * - themeMode localStorage 값이 있으면: 사용자가 선택한 테마 사용, 시스템 테마 무시
 * - themeMode localStorage 값이 없으면: 시스템 테마 따라감
 */
export const RootLayoutProvider = ({ children }: { children: React.ReactNode }) => {
    const [themeMode, setThemeMode] = useAtom(themeModeState);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(
        function syncThemeModeToHtmlClass() {
            // 현재 HTML 클래스와 다를 때만 변경 (깜박임 방지)
            const currentClass = document.documentElement.className;
            if (currentClass !== themeMode) {
                themeLogger('RootLayoutProvider: HTML className 변경', {
                    from: currentClass,
                    to: themeMode,
                });
                document.documentElement.className = themeMode;
            }
        },
        [themeMode]
    );

    // 초기화: themeMode localStorage 유무로 사용자 선택 여부 판단
    useEffect(function initializeTheme() {
        try {
            const savedTheme = localStorage.getItem('themeMode');
            const hasUserSelection = savedTheme !== null;

            if (hasUserSelection) {
                // 사용자가 이미 테마를 선택한 경우 - atomWithStorage가 자동으로 로드
                themeLogger('RootLayoutProvider: 사용자 선택 테마 로드', {
                    savedTheme,
                });
            } else {
                // 사용자가 테마를 선택하지 않은 경우 - 시스템 테마 적용
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const systemTheme = prefersDark ? 'black' : 'gray';
                themeLogger('RootLayoutProvider: 시스템 테마 감지 및 적용', {
                    prefersDark,
                    systemTheme,
                });
                // atom 업데이트 (atomWithStorage가 저장하지만 바로 삭제)
                setThemeMode(systemTheme);
                // 저장 방지를 위해 바로 제거 (시스템 테마는 저장하지 않음)
                localStorage.removeItem('themeMode');
            }
            setIsInitialized(true);
        } catch (e) {
            themeLogger('RootLayoutProvider: 초기화 실패', e);
            setIsInitialized(true);
        }
    }, []);

    // 시스템 테마 실시간 추적 (themeMode localStorage가 없는 경우만)
    useEffect(
        function trackSystemThemeChanges() {
            if (!isInitialized) {
                return;
            }

            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
                // themeMode localStorage 유무로 사용자 선택 여부 판단
                const hasUserSelection = localStorage.getItem('themeMode') !== null;
                if (hasUserSelection) {
                    themeLogger(
                        'RootLayoutProvider: 사용자가 테마를 선택했으므로 시스템 테마 변경 무시'
                    );
                    return;
                }

                const prefersDark = e.matches;
                const systemTheme = prefersDark ? 'black' : 'gray';
                themeLogger('RootLayoutProvider: 시스템 테마 변경 감지', {
                    prefersDark,
                    systemTheme,
                });
                setThemeMode(systemTheme);
                // 저장 방지 (시스템 테마는 저장하지 않음)
                localStorage.removeItem('themeMode');
            };

            // 이벤트 리스너 등록
            mediaQuery.addEventListener('change', handleThemeChange);

            return () => {
                mediaQuery.removeEventListener('change', handleThemeChange);
            };
        },
        [isInitialized, setThemeMode]
    );

    return <div>{children}</div>;
};
