import React from 'react';
import TrashIcon from '@/public/icon/TrashIcon';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';

export interface DeleteButtonProps extends Omit<ButtonBaseProps, 'icon' | 'label' | 'title'> {
    label?: string;
}

/**
 * 삭제 버튼 컴포넌트
 */
export const DeleteButton: React.FC<DeleteButtonProps> = ({
    onClick,
    disabled = false,
    hideTextOnMobile = false,
    label,
}) => {
    return (
        <ButtonBase
            icon={<TrashIcon />}
            label={label || '삭제'}
            title={label || '삭제'}
            onClick={onClick}
            disabled={disabled}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
};
