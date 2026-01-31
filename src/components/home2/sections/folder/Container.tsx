'use client';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { currentPageState, openFolderCreationDialogState } from '@/lib/jotai';
import { useFoldersData } from '@/hooks/useFoldersData';
import { enhancedRenderLogger } from '@/debug/render';
import { folderLogger } from '@/debug/folder';
import { requestHapticFeedback } from '@/utils/hapticFeedback';
import Presentation from './Presentation';

export default function Container() {
    enhancedRenderLogger('components/home2/sections/folder/Container.tsx');

    const location = useLocation();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const openFolderCreationDialog = useSetAtom(openFolderCreationDialogState);

    // 폴더 데이터 가져오기
    const { folders } = useFoldersData();

    enhancedRenderLogger('FolderContainer', {
        folders,
        location,
        currentPage,
    });

    // 컴포넌트 마운트 시 상태 설정
    useEffect(
        function initializeFolderListState() {
            setCurrentPage({
                type: 'FOLDER_LIST',
                id: null,
                path: '/home/folder',
            });
            folderLogger('폴더 목록 페이지 진입');
        },
        [setCurrentPage]
    );

    // 폴더 선택 핸들러
    const handleFolderSelect = useCallback(
        (id: string) => {
            folderLogger('폴더 선택', { folderId: id });
            navigate(`${id}`);
            requestHapticFeedback();
        },
        [navigate]
    );

    // 폴더 생성 핸들러
    const handleCreateFolder = useCallback(() => {
        folderLogger('폴더 생성 다이얼로그 열기');
        openFolderCreationDialog({});
        requestHapticFeedback();
    }, [openFolderCreationDialog]);

    return (
        <Presentation
            folders={folders}
            onSelect={handleFolderSelect}
            onCreateFolder={handleCreateFolder}
        />
    );
}
