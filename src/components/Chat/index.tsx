'use client';

import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { Z_INDEX } from '@/constants';
import { useAtom, useSetAtom } from 'jotai';
import { chatOpenState, chatScrollToBottomState, drawerWidthState } from '@/lib/jotai';
import { runEmbedding } from '@/functions/ai/runEmbedding';
import { chatLogger } from '@/debug/chat';
import { createPortal } from 'react-dom';
import Image from 'next/image';

// Root 컴포넌트를 lazy loading으로 변경하여 초기 번들 크기 감소
const Root = lazy(() => import('./Root'));

// Chat 로딩 컴포넌트
function ChatLoading() {
    return (
        <div className="flex items-center justify-center h-full w-full">
            <Image
                src="/icon/redactor-ai-loading.svg"
                height={39}
                width={39}
                alt="loading"
                className="otu_loading mx-auto"
            />
        </div>
    );
}

const MIN_SIZE = 150;
const INIT_SIZE = 300;

function Chat() {
    const [mounted, setMounted] = useState(false);
    const [chatOpen, setChatOpen] = useAtom(chatOpenState);
    const setChatScrollToBottom = useSetAtom(chatScrollToBottomState);
    const [drawerWidth, setDrawerWidth] = useAtom(drawerWidthState);
    const resizing = useRef(false);

    useEffect(function initializeMounted() {
        setMounted(true);
        // 임베딩은 최초 마운트 시 한 번만 실행
        (async () => {
            try {
                await runEmbedding();
            } catch (e) {
                // 임베딩 실패는 사용자에 노출하지 않음
            }
        })();
    }, []);

    // Esc로 닫기
    useEffect(
        function bindEscClose() {
            if (!chatOpen) return;
            const escClose = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    setChatOpen(false);
                }
            };
            window.addEventListener('keydown', escClose);
            return () => window.removeEventListener('keydown', escClose);
        },
        [chatOpen, setChatOpen]
    );

    // 열릴 때 스크롤 하단 이동 (애니메이션 없이)
    useEffect(
        function scrollToBottomOnOpen() {
            if (!chatOpen) return;
            requestAnimationFrame(() => {
                setChatScrollToBottom(Math.random() * -1);
            });
        },
        [chatOpen, setChatScrollToBottom]
    );

    // 루트 스크롤바 숨김 토글
    useEffect(
        function toggleRootScrollbar() {
            const rootElement = document.getElementById('root');
            if (!rootElement) return;
            if (chatOpen) {
                rootElement.style.scrollbarWidth = 'none';
                rootElement.style.setProperty('-ms-overflow-style', 'none');
                rootElement.classList.add('hide-scrollbar');
            } else {
                rootElement.style.scrollbarWidth = '';
                rootElement.style.removeProperty('-ms-overflow-style');
                rootElement.classList.remove('hide-scrollbar');
            }
            return () => {
                rootElement.style.scrollbarWidth = '';
                rootElement.style.removeProperty('-ms-overflow-style');
                rootElement.classList.remove('hide-scrollbar');
            };
        },
        [chatOpen]
    );

    // 리사이즈 핸들링 (마우스/터치)
    const handleDragStart = (origin: 'handle' | 'container' = 'handle') => {
        chatLogger('drag:start', { origin });
        document.body.classList.add('disable-selection');
        document.getElementById('chat_drag_handle')?.classList.add('dragging');
        resizing.current = true;
    };

    // 컨테이너 드래그는 비활성화하고 핸들만 사용

    const applyWidth = (nextWidth: number) => {
        const clamped = Math.min(nextWidth > MIN_SIZE ? nextWidth : MIN_SIZE, window.innerWidth);
        setDrawerWidth(clamped);
        return clamped;
    };

    const handleMouseDragMove = (e: MouseEvent) => {
        if (!resizing.current) return;
        const newWidth = window.innerWidth - e.clientX;
        const width = applyWidth(newWidth);
        chatLogger('drag:move', { type: 'mouse', clientX: e.clientX, width });
    };

    const handleTouchDragMove = (e: TouchEvent) => {
        if (!resizing.current) return;
        const touch = e.touches[0];
        const newWidth = window.innerWidth - touch.clientX;
        const width = applyWidth(newWidth);
        chatLogger('drag:move', { type: 'touch', clientX: touch.clientX, width });
    };

    const handleDragEnd = () => {
        chatLogger('drag:end');
        document.body.classList.remove('disable-selection');
        document.getElementById('chat_drag_handle')?.classList.remove('dragging');
        resizing.current = false;
    };

    const preventScroll = (e: WheelEvent | TouchEvent) => {
        if (resizing.current) {
            e.preventDefault();
        }
    };

    useEffect(function bindDragListeners() {
        window.addEventListener('mousemove', handleMouseDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        window.addEventListener('touchmove', handleTouchDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd);
        window.addEventListener('wheel', preventScroll, { passive: false });
        window.addEventListener('touchmove', preventScroll, { passive: false });
        return () => {
            window.removeEventListener('mousemove', handleMouseDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleTouchDragMove);
            window.removeEventListener('touchend', handleDragEnd);
            window.removeEventListener('touchcancel', handleDragEnd);
            window.removeEventListener('wheel', preventScroll);
            window.removeEventListener('touchmove', preventScroll);
        };
    }, []);

    useEffect(
        function clampWidthOnResize() {
            const handleResize = () => {
                setDrawerWidth((prev) => Math.min(prev, window.innerWidth));
            };
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        },
        [setDrawerWidth]
    );

    // 초기 폭 설정 (최초 열릴 때)
    useEffect(
        function initializeWidthOnOpen() {
            if (!chatOpen) return;
            setDrawerWidth((prev) => prev || INIT_SIZE);
        },
        [chatOpen, setDrawerWidth]
    );

    if (!mounted) return null;
    if (!chatOpen) return null;

    const isResizing = resizing.current;

    return (
        <div
            id="chat_container"
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                width: drawerWidth,
                height: '100%',
                zIndex: Z_INDEX.CHAT_DRAWER,
                pointerEvents: 'auto',
                transition: isResizing ? 'none' : 'width 0.2s ease',
                touchAction: 'pan-y',
            }}
        >
            <div id="ai_root" className={`w-full h-screen`}>
                <div id="ai_top_root" className="fixed z-50 right-0 mt-2 flex scale-75"></div>
                <div
                    id="chat_drag_handle"
                    className="absolute left-0 top-0 z-30 h-[100%] w-[15px] cursor-ew-resize flex items-center justify-center hover-emphasis hover:opacity-70"
                    onMouseDown={() => handleDragStart('handle')}
                    onTouchStart={() => handleDragStart('handle')}
                    style={{ touchAction: 'none' }}
                    aria-label="Resize chat panel"
                    role="separator"
                    aria-orientation="vertical"
                >
                    <div className="bg-text-color opacity-30 h-[8rem] rounded-md w-[3px]"></div>
                </div>
                <Suspense fallback={<ChatLoading />}>
                    <Root />
                </Suspense>
            </div>
        </div>
    );
}

function ChatPortal() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(<Chat />, document.body);
}

export { ChatPortal as Chat };
