import React from 'react';
import BellIcon from '@/public/icon/BellIcon';
import BellSlashIcon from '@/public/icon/BellSlashIcon';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useTranslations } from 'next-intl';

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
    const t = useTranslations('editor');

    return (
        <ButtonBase
            icon={isActive ? <BellSlashIcon /> : <BellIcon />}
            label={isActive ? onLabel || t('reminder-off') : offLabel || t('reminder-on')}
            title={label || t('reminder')}
            onClick={onClick}
            disabled={disabled}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
};
