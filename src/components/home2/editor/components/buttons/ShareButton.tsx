import React from 'react';
import { ShareIcon } from '@heroicons/react/20/solid';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';

export interface ShareButtonProps extends Omit<ButtonBaseProps, 'icon' | 'label' | 'title'> {
    label?: string;
}

/**
 * 공유 버튼 컴포넌트
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
    onClick,
    disabled = false,
    hideTextOnMobile = false,
    label,
}) => {
    return (
        <ButtonBase
            icon={<ShareIcon className="w-3.5 h-3.5" />}
            label={label || '공유'}
            title={label || '공유'}
            onClick={onClick}
            disabled={disabled}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
};
