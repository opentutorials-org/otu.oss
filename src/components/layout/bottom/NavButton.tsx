import { captureMessage } from '@sentry/nextjs';
import React, { memo, ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { selectionModeState } from '@/lib/jotai';

export interface NavButtonProps {
    onClick?: () => void;
    children: ReactNode;
    isActive?: boolean;
}

const OVER_OPACITY = 0.5;

/**
 * 하단 네비게이션 버튼 컴포넌트 (단순한 버튼)
 */
export const NavButton = memo(({ onClick, children, isActive }: NavButtonProps) => {
    const clickHandler =
        typeof onClick === 'function'
            ? onClick
            : () => {
                  console.warn('NavButton onClick이 정의되지 않았거나 함수가 아닙니다.');
                  captureMessage('NavButton onClick이 정의되지 않았습니다.');
              };

    return (
        <button
            onClick={clickHandler}
            className="bg-transparent border-none cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text-color)] focus-visible:rounded-lg"
            style={{
                opacity: isActive ? 1 : OVER_OPACITY,
            }}
        >
            <div className="flex flex-col items-center">{children}</div>
        </button>
    );
});

export const NavButtonLabel = memo(({ children }: { children: string }) => {
    const selectionMode = useAtomValue(selectionModeState);
    return (
        <div
            style={{ fontSize: '0.875rem' }}
            className={`font-semibold ${selectionMode ? 'inverted-text-color' : 'text-color'} mt-[7px]`}
        >
            {children}
        </div>
    );
});

NavButtonLabel.displayName = 'NavButtonLabel';
