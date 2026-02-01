import React from 'react';
import CopyBeforeIcon from '@/public/icon/copyBeforeIcon';
import CopyAfterIcon from '@/public/icon/copyAfterIcon';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';

export interface CopyButtonProps extends Omit<ButtonBaseProps, 'icon' | 'label' | 'title'> {
    copied: boolean;
    label?: string;
}

/**
 * 복사 버튼 컴포넌트
 */
export const CopyButton: React.FC<CopyButtonProps> = ({
    onClick,
    copied,
    disabled = false,
    hideTextOnMobile = false,
    label,
}) => {
    return (
        <ButtonBase
            icon={copied ? <CopyAfterIcon /> : <CopyBeforeIcon />}
            label={label || '복사'}
            title={label || '복사'}
            onClick={onClick}
            disabled={disabled}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
};
