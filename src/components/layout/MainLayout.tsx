'use client';
import {
    chatState,
    currentPagePathToType,
    currentPageState,
    globalBackDropState,
    mainScrollPaneState,
    scrollTopRandomState,
} from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import Bottom from './bottom';
import { useEffect, useMemo, useRef, memo, useState } from 'react';
import { usePathname } from 'next/navigation';
import React from 'react';
import Backdrop from '@mui/material/Backdrop';
import s from './MainLayout.module.css';
import { DocumentTitleUpdater } from '../core/DocumentTitleUpdater';
import { navPageLogger } from '@/debug/nav';
import { Top } from './top';
import { chatOpenState, drawerWidthState } from '@/lib/jotai';
import { layoutChatLogger } from '../../debug/layout';

type SideArticleLayoutPropsType = {
    sidebar?: React.ReactNode;
    children: React.ReactNode;
    bottom?: boolean;
    menu?: boolean;
};
const SideArticleLayout = memo(function SideArticleLayout({
    children,
    bottom = true,
    menu = true,
}: SideArticleLayoutPropsType) {
    const [search, setSearch] = useAtom(chatState);
    const mainRef = useRef<HTMLDivElement>(null);
    const lastHomeScrollY = useRef<number | null>(0);
    const pathname = usePathname();
    const rootRef = useRef<HTMLDivElement>(null);
    const chatOpen = useAtomValue(chatOpenState);
    const drawerWidth = useAtomValue(drawerWidthState);
    const [windowWidth, setWindowWidth] = useState<number | null>(null);

    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const scrollTopRandom = useAtomValue(scrollTopRandomState);
    const setMainScrollPane = useSetAtom(mainScrollPaneState);
    const globalBackDrop = useAtomValue(globalBackDropState);

    // currentPage를 useRef로 최신 상태를 참조
    const currentPageRef = useRef(currentPage);
    currentPageRef.current = currentPage;

    // Check if we're in the editor
    const isInEditor = ['PAGE_EDIT', 'PAGE_CREATE', 'PAGE_READ'].includes(currentPage.type);

    // currentPage 변화 추적
    useEffect(() => {
        // currentPage 변화를 추적하는 로직이 필요한 경우 여기에 추가
    }, [currentPage]);

    // 실제 뷰포트 높이를 계산하고 CSS 변수로 설정하는 함수
    useEffect(() => {
        function setCustomViewportHeight() {
            const doc = document.documentElement;
            doc.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        }

        setCustomViewportHeight();
        window.addEventListener('resize', setCustomViewportHeight);

        return () => window.removeEventListener('resize', setCustomViewportHeight);
    }, []);

    // 뷰포트 폭 감지
    useEffect(function handleWindowResizeWatcher() {
        const handle = () => setWindowWidth(window.innerWidth);
        handle();
        window.addEventListener('resize', handle);
        return () => window.removeEventListener('resize', handle);
    }, []);

    useEffect(
        function watchingPathChange() {
            navPageLogger('watchingPathChange called:', {
                pathname,
                currentPagePath: currentPageRef.current.path,
            });

            if (pathname !== currentPageRef.current.path) {
                navPageLogger('Path change detected:', {
                    from: currentPageRef.current.path,
                    to: pathname,
                    currentPageType: currentPageRef.current.type,
                    currentPageId: currentPageRef.current.id,
                });

                const pathObj = pathname
                    ? currentPagePathToType(pathname)
                    : currentPagePathToType('/');

                navPageLogger('Path converted to pageObj:', pathObj);

                // 이미 같은 타입과 ID를 가진 페이지라면 업데이트하지 않음 (navigateWithState에 의한 변경 무시)
                if (
                    pathObj.type === currentPageRef.current.type &&
                    pathObj.id === currentPageRef.current.id
                ) {
                    navPageLogger('Same page detected, skipping update:', {
                        type: pathObj.type,
                        id: pathObj.id,
                    });
                    return;
                }

                // extraData가 있고 같은 페이지 타입이면 extraData를 보존
                if (
                    currentPageRef.current.extraData &&
                    pathObj.type === currentPageRef.current.type &&
                    pathObj.id === currentPageRef.current.id
                ) {
                    navPageLogger('Preserving extraData:', {
                        extraData: currentPageRef.current.extraData,
                        pathObj,
                    });
                    setCurrentPage({ ...pathObj, extraData: currentPageRef.current.extraData });
                } else {
                    navPageLogger('Setting new currentPage:', pathObj);
                    setCurrentPage(pathObj);
                }
            }
        },
        [pathname]
    );

    useEffect(
        function homeScrollTop() {
            requestAnimationFrame(() => {
                // logined_main 엘리먼트를 직접 찾아서 스크롤
                const loginedMainElement = document.getElementById('logined_main');
                if (loginedMainElement) {
                    loginedMainElement.scrollTo(0, 0);
                }
            });
        },
        [scrollTopRandom]
    );

    useEffect(
        function MainScrollPaneRefToGlobal() {
            // logined_main 엘리먼트를 직접 찾아서 전역 상태에 설정
            const loginedMainElement = document.getElementById(
                'logined_main'
            ) as HTMLDivElement | null;
            setMainScrollPane(loginedMainElement);
        },
        [scrollTopRandom] // logined_main이 렌더링될 때마다 업데이트되도록 의존성 변경
    );

    useEffect(() => {
        if (!mainRef.current) return;
        if (globalBackDrop) {
            mainRef.current.style.filter = 'blur(3px)';
        } else {
            mainRef.current.style.filter = 'none';
        }
    }, [globalBackDrop]);

    const rootStyle: React.CSSProperties = useMemo(() => {
        const vw = windowWidth ?? 0;
        const availableWidth = vw - drawerWidth;
        const isParallel = chatOpen && availableWidth >= 680;
        return {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100dvh',
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            overflow: 'hidden',
            touchAction: 'pan-x pan-y',
            overscrollBehavior: 'none',
            WebkitOverflowScrolling: 'touch',
            // paddingTop: 'calc(env(safe-area-inset-top) / 2)',
            // paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: isParallel
                ? `calc(env(safe-area-inset-right) + ${drawerWidth}px)`
                : 'env(safe-area-inset-right)',
            transition: 'padding-right 0.2s ease',
        };
    }, [chatOpen, windowWidth, drawerWidth]);

    useEffect(
        function logChatResponsiveLayout() {
            const vw = windowWidth ?? 0;
            const availableWidth = vw - drawerWidth;
            const isParallel = chatOpen && availableWidth >= 680;
            layoutChatLogger('responsive layout check', {
                chatOpen,
                windowWidth: vw,
                drawerWidth,
                availableWidth,
                isParallel,
            });
        },
        [chatOpen, windowWidth, drawerWidth]
    );

    return (
        <>
            <div id="root" ref={rootRef} style={rootStyle}>
                <Top menu={menu}></Top>
                <div className="flex justify-center w-full overflow-y-scroll scrolling-touch">
                    {children}
                </div>
                <Bottom />
            </div>
            <DocumentTitleUpdater />
            <Backdrop open={globalBackDrop}></Backdrop>
        </>
    );
});

export { SideArticleLayout };
