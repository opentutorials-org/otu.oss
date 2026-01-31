'use client';
import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import MainNavigation from './main';
import {
    chatOpenState,
    drawerWidthState,
    selectionModeState,
    resetSelectionState,
} from '@/lib/jotai';
import SelectionNavigation from './selection';
import { navBottomLogger } from '@/debug/nav';

export default function Bottom() {
    const selectionMode = useAtomValue(selectionModeState);
    const chatOpen = useAtomValue(chatOpenState);
    const drawerWidth = useAtomValue(drawerWidthState);
    const resetSelection = useSetAtom(resetSelectionState);
    const [windowWidth, setWindowWidth] = useState<number | null>(null);

    useEffect(
        function logSelectionModeChange() {
            navBottomLogger('selectionMode 변경 감지', { selectionMode });
        },
        [selectionMode]
    );

    useEffect(function handleWindowResizeWatcher() {
        const handle = () => setWindowWidth(window.innerWidth);
        handle();
        window.addEventListener('resize', handle);
        return () => window.removeEventListener('resize', handle);
    }, []);

    useEffect(
        function logBottomResponsiveLayout() {
            const vw = windowWidth ?? 0;
            const availableWidth = vw - drawerWidth;
            const isParallel = chatOpen && availableWidth >= 680;
            navBottomLogger('bottom responsive layout check', {
                chatOpen,
                windowWidth: vw,
                drawerWidth,
                availableWidth,
                isParallel,
                appliedRightOffset: isParallel ? drawerWidth : 0,
            });
        },
        [chatOpen, windowWidth, drawerWidth]
    );

    return (
        <div
            id="bottom_menu_root"
            style={{
                paddingBottom: 'var(--native-bottom-inset, env(safe-area-inset-bottom))',
                backgroundColor: selectionMode ? 'var(--selection-bar-bg)' : 'var(--bg-color)',
                color: selectionMode ? 'var(--inverted-text-color)' : 'var(--text-color)',
                transition: 'background-color 0.15s ease-out, color 0.15s ease-out',
            }}
            onTransitionEnd={() =>
                navBottomLogger('배경색 전환 애니메이션 완료', { selectionMode })
            }
        >
            <div className="flex-auto flex justify-center border-t-solid border-t-[1px] border-color-faint">
                <div className="w-full max-w-[680px] sm:px-[19px]">
                    {selectionMode ? <SelectionNavigation /> : <MainNavigation />}
                </div>
            </div>
        </div>
    );
}
