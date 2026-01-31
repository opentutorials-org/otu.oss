'use client';
import { chatOpenState, loginedMenuAnchorState } from '@/lib/jotai';
import { useAtom, useAtomValue } from 'jotai';
import React, { useEffect, useRef, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { controlLogger } from '@/debug/control';
import { Z_INDEX } from '@/constants';

type ControlProps = {
    children: React.ReactNode;
};

const RIGHT_CONTROL_PADDING = 20;

export const Control = memo(function Control({ children }: ControlProps) {
    // Next.js SSR을 피하기 위한 mounted state
    const [mounted, setMounted] = useState(false);
    const selfRef = useRef<HTMLDivElement>(null);
    const [chatOpen] = useAtom(chatOpenState);
    const loginedMenuAnchor = useAtomValue(loginedMenuAnchorState);
    const open = Boolean(loginedMenuAnchor);

    controlLogger('🎮 Control 컴포넌트 렌더링 시작', {
        mounted,
        chatOpen,
        loginedMenuAnchor,
        open,
    });

    const handleResize = () => {
        controlLogger('📏 handleResize 호출');
        // DOM 렌더링이 완료된 후 위치 계산 실행
        requestAnimationFrame(() => {
            const editor_root_wapper_spacer = document.querySelector('#editor_root_wapper_spacer');
            if (editor_root_wapper_spacer && selfRef.current) {
                const bouncing = editor_root_wapper_spacer.getBoundingClientRect();
                controlLogger('📐 위치 계산', { bouncing, windowWidth: window.innerWidth });

                if (bouncing.x === 0) {
                    // ios safari 등에서 bouncing.x가 최초에 0이 되는 경우가 있어서 버튼이 덜렁거리는 문제가 있었음.
                    controlLogger('⚠️ bouncing.x가 0이므로 기본 위치로 설정');
                    // 기본 위치로 설정 (우측에서 20px 떨어진 위치)
                    selfRef.current.style.right = `${RIGHT_CONTROL_PADDING}px`;
                    controlLogger('✅ 기본 위치 설정 완료', {
                        rightPosition: RIGHT_CONTROL_PADDING,
                    });
                    return;
                }
                const windowWidth = window.innerWidth;
                const rightPosition =
                    windowWidth - (bouncing.x + bouncing.width) + RIGHT_CONTROL_PADDING;
                selfRef.current.style.right = `${rightPosition}px`;
                controlLogger('✅ 위치 설정 완료', { rightPosition });
            } else {
                controlLogger('❌ editor_root_wapper_spacer 또는 selfRef.current를 찾지 못함', {
                    editor_root_wapper_spacer: !!editor_root_wapper_spacer,
                    selfRef: !!selfRef.current,
                });
                // 대안: 요소를 찾지 못한 경우에도 기본 위치로 표시
                if (selfRef.current) {
                    selfRef.current.style.right = `${RIGHT_CONTROL_PADDING}px`;
                    controlLogger('✅ 대안 위치 설정 완료', {
                        rightPosition: RIGHT_CONTROL_PADDING,
                    });
                }
            }
        });
    };

    useEffect(() => {
        controlLogger('🚀 mounted useEffect 실행');
        // Client에서만 마운트 상태 변경 및 위치 조정
        setMounted(true);
        // 즉시 위치 설정 (requestAnimationFrame 제거로 성능 향상)
        handleResize();
    }, [handleResize]);

    useEffect(() => {
        controlLogger('📱 resize 이벤트 리스너 등록');
        // 리사이즈 이벤트 리스너 추가
        window.addEventListener('resize', handleResize);

        return () => {
            controlLogger('🧹 resize 이벤트 리스너 해제');
            // 클린업 함수에서 이벤트 리스너와 인터벌 해제
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        controlLogger('💬 chatOpen 변경됨', { chatOpen });
        handleResize();
    }, [chatOpen, handleResize]);

    // SSR에서는 렌더링하지 않음
    if (!mounted) {
        controlLogger('❌ mounted가 false이므로 렌더링하지 않음');
        return null;
    }

    // settingState.open이 true이면 렌더링하지 않음
    if (open) {
        controlLogger('❌ loginedMenuAnchor가 열려있어서 렌더링하지 않음', { loginedMenuAnchor });
        return null;
    }

    controlLogger('✅ Control 컴포넌트 렌더링 중...');

    // Portal을 통해 body에 고정 위치로 렌더링
    // Native CSS animation replacement for motion.div
    // initial={{ opacity: 0 }}
    // animate={{ opacity: 1, y: 0 }}
    // transition={{ duration: 0.3, delay: 0.5 }}
    return createPortal(
        <>
            <style jsx global>{`
                @keyframes controlFadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                #control_root {
                    animation: controlFadeIn 0.3s ease-out 0.5s forwards;
                    opacity: 0; /* Start hidden for delay */
                }
            `}</style>
            <div
                id="control_root"
                className="fixed flex justify-center left-auto right-[-100px]"
                style={{
                    bottom: 'calc(env(safe-area-inset-bottom) + 1.3rem)',
                    zIndex: Z_INDEX.CONTROL_FLOATING,
                    transition: 'right 0.3s ease-out', // Smooth movement when resizing
                }}
                ref={selfRef}
            >
                {children}
            </div>
        </>,
        document.body
    );
});
