import React from 'react';
import BellIcon from '@/public/icon/BellIcon';
import BellSlashIcon from '@/public/icon/BellSlashIcon';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useLingui } from '@lingui/react/macro';

export interface ReminderButtonProps extends Omit<ButtonBaseProps, 'icon' | 'label' | 'title'> {
    isActive: boolean;
    onLabel?: string;
    offLabel?: string;
    label?: string;
}

/**
 * 리마인더 버튼 컴포넌트
 */
export const ReminderButton: React.FC<ReminderButtonProps> = ({
    onClick,
    isActive,
    disabled = false,
    hideTextOnMobile = false,
    onLabel,
    offLabel,
    label,
}) => {
    const { t } = useLingui();

    return (
        <ButtonBase
            icon={isActive ? <BellSlashIcon /> : <BellIcon />}
            label={isActive ? onLabel || t`리마인더 끄기` : offLabel || t`리마인더 시작`}
            title={label || t`리마인더`}
            onClick={onClick}
            disabled={disabled}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
};
