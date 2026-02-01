import React from 'react';
import { ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { useLingui } from '@lingui/react/macro';

export interface PublishButtonProps extends Omit<ButtonBaseProps, 'icon' | 'label' | 'title'> {
    isPublished: boolean;
}

/**
 * 웹페이지 발행 버튼 컴포넌트
 */
export const PublishButton: React.FC<PublishButtonProps> = ({
    onClick,
    isPublished,
    disabled = false,
    hideTextOnMobile = false,
    opacity,
}) => {
    const { t } = useLingui();

    return (
        <ButtonBase
            icon={
                <ComputerDesktopIcon style={{ width: '100%', height: '100%', display: 'block' }} />
            }
            label={isPublished ? t`발행됨` : t`발행하기`}
            title={isPublished ? t`발행됨` : t`발행하기`}
            onClick={onClick}
            disabled={disabled}
            hideTextOnMobile={hideTextOnMobile}
            opacity={opacity}
        />
    );
};
