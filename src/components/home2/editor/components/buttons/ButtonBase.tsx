import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, { ReactNode, useState } from 'react';
import { withStrongTapMotion } from '@/components/common/withMotionEffects';

export interface ButtonBaseProps {
    icon: ReactNode;
    label: string;
    title: string;
    onClick: () => void;
    disabled?: boolean;
    hideTextOnMobile?: boolean;
    opacity?: string;
    labelFontSize?: string;
}

/**
 * 모든 버튼 컴포넌트의 기본이 되는 베이스 컴포넌트 (Motion 효과 제외)
 */
const ButtonBaseComponent: React.FC<ButtonBaseProps> = ({
    icon,
    label,
    title,
    onClick,
    disabled = false,
    hideTextOnMobile = false,
    opacity = '.45',
    labelFontSize = '11px',
}) => {
    const [isPressed, setIsPressed] = useState(false);

    return (
        <IconButton
            disableRipple
            className={`!p-0 ${
                disabled
                    ? '!opacity-[.35] cursor-not-allowed'
                    : `${isPressed ? '!opacity-[1]' : `!opacity-[.5]`} hover:!opacity-[1]`
            }`}
            onClick={() => {
                if (!disabled) {
                    onClick();
                }
            }}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            onTouchCancel={() => setIsPressed(false)}
            title={title}
            disabled={disabled}
        >
            <span className="flex items-center">
                <span className="w-[16px] h-[16px] mr-[2px] flex items-center justify-center">
                    {icon}
                </span>
                <span
                    className={`text-[${labelFontSize}] inline-block ${hideTextOnMobile ? 'max-sm:hidden' : ''}`}
                >
                    {label}
                </span>
            </span>
        </IconButton>
    );
};

// HOC를 적용한 ButtonBase 내보내기
export const ButtonBase = ButtonBaseComponent;
