import IconButton from '@mui/material/IconButton';
import React, { memo, ReactNode } from 'react';
import DeleteIcon from '@/public/icon/DeleteIcon';
import EditIcon from '@/public/icon/EditIcon';
import ReadIcon from '@/public/icon/ReadIcon';

type ActionButtonProps = {
    icon: ReactNode;
    onClick: () => void;
    title: string;
    label?: string;
    hideTextOnMobile?: boolean;
};

/**
 * 공통으로 사용되는 액션 버튼 컴포넌트
 */
export const ActionButton = memo(function ActionButton({
    icon,
    onClick,
    title,
    label,
    hideTextOnMobile = false,
}: ActionButtonProps) {
    return (
        <IconButton
            disableRipple
            className="!opacity-[.65] hover:!opacity-[1] !p-0"
            onClick={onClick}
            title={title}
        >
            {icon}
            {label && (
                <span className={`text-[16px] ${hideTextOnMobile ? 'hide-on-400' : ''}`}>
                    {label}
                </span>
            )}
        </IconButton>
    );
});

/**
 * 삭제 버튼 컴포넌트
 */
export const DeleteButton = memo(function DeleteButton({
    onClick,
    label,
    hideTextOnMobile = false,
}: Omit<ActionButtonProps, 'icon' | 'title'> & { label: string }) {
    return (
        <ActionButton
            icon={<DeleteIcon className="w-[18px] h-[18px] mr-[2px]" />}
            onClick={onClick}
            title={label}
            label={label}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
});

/**
 * 편집 버튼 컴포넌트
 */
export const EditButton = memo(function EditButton({
    onClick,
    label,
    hideTextOnMobile = false,
}: Omit<ActionButtonProps, 'icon' | 'title'> & { label: string }) {
    return (
        <ActionButton
            icon={<EditIcon className="w-5 h-5 mr-[2px]" />}
            onClick={onClick}
            title={label}
            label={label}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
});

/**
 * 읽기 모드 버튼 컴포넌트
 */
export const ReadButton = memo(function ReadButton({
    onClick,
    label,
    hideTextOnMobile = false,
}: Omit<ActionButtonProps, 'icon' | 'title'> & { label: string }) {
    return (
        <ActionButton
            icon={<ReadIcon className="w-5 h-5 mr-[2px]" />}
            onClick={onClick}
            title={label}
            label={label}
            hideTextOnMobile={hideTextOnMobile}
        />
    );
});
