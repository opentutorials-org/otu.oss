import React from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import { ButtonBase, ButtonBaseProps } from './ButtonBase';
import { FolderArrowDownIcon, FolderPlusIcon } from '@heroicons/react/24/outline';

export interface FolderButtonProps extends Omit<ButtonBaseProps, 'icon' | 'label' | 'title'> {
    label?: string;
}

/**
 * 폴더 버튼 컴포넌트
 */
export const FolderButton: React.FC<FolderButtonProps> = ({
    onClick,
    disabled = false,
    hideTextOnMobile = false,
    label,
}) => {
    return (
        <ButtonBase
            icon={<FolderPlusIcon className="w-4 h-4" />}
            label={label || '폴더'}
            title={label || '폴더'}
            onClick={onClick}
            disabled={disabled}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
};
