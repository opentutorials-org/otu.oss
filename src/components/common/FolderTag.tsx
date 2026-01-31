import React from 'react';
import { useGetFolderName } from '@/hooks/useFoldersData';
import { useAtomValue } from 'jotai';
import { selectionModeState } from '@/lib/jotai';
import { useNavigate } from 'react-router-dom';

interface FolderTagProps {
    folderId: string | null | undefined;
    hideFolderName?: boolean;
    className?: string;
    variant?: 'grid' | 'list';
}

export const FolderTag: React.FC<FolderTagProps> = ({
    folderId,
    hideFolderName = false,
    className = '',
    variant = 'grid',
}) => {
    const getFolderName = useGetFolderName();
    const folderName = getFolderName(folderId);
    const selectionMode = useAtomValue(selectionModeState);
    const navigate = useNavigate();

    if (!folderName || hideFolderName) {
        return null;
    }

    const baseClasses = selectionMode
        ? 'transition-opacity cursor-default'
        : 'cursor-pointer transition-opacity hover:opacity-80';
    const variantClasses =
        variant === 'grid'
            ? 'float-left text-[10px] px-[5px] py-0  mt-[3px] mr-[5px] rounded-md focus-bg-color text-color'
            : 'float-left text-[13px] px-[5px] py-0 mt-[2px] mr-[4px] rounded-lg focus-bg-color text-color';

    return (
        <span
            onClick={(e) => {
                e.stopPropagation();
                // 다중선택 모드에서는 폴더명 클릭을 무시
                if (selectionMode) {
                    return;
                }
                if (folderId) {
                    navigate(`/folder/${folderId}`);
                }
            }}
            className={`${baseClasses} ${variantClasses} ${className} truncate`}
            title={folderName}
        >
            {folderName}
        </span>
    );
};

export default FolderTag;
