'use client';

import { useParams, useLocation, useNavigate, Outlet } from 'react-router-dom';
import SwipeableModal from '../../shared/SwipeableModal';
import PageContainer from '../page/Container';
import { useState, useCallback, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { enhancedRenderLogger } from '@/debug/render';
import { folderLogger } from '@/debug/folder';
import { useNavigation } from '@/hooks/useNavigation';
import { getFolders } from '@/functions/folder';
import { list as listPages } from '@/watermelondb/control/Page';
import * as Sentry from '@sentry/nextjs';
import {
    FolderOpenIcon,
    PencilSquareIcon,
    TrashIcon,
    EllipsisHorizontalCircleIcon,
} from '@heroicons/react/24/outline';
import { Z_INDEX } from '@/constants';

import { requestHapticFeedback } from '@/utils/hapticFeedback';
import {
    currentPageState,
    openConfirmState,
    openSnackbarState,
    refreshListState,
} from '@/lib/jotai';
import { useTranslations } from 'next-intl';
import { useRefreshFolders } from '@/hooks/useFoldersData';
import {
    IconButton,
    CircularProgress,
    TextField,
    Menu,
    MenuItem,
    Fade,
    Button,
} from '@mui/material';
import TopControls from '@/components/home/shared/TopControls';

// FolderDetailPageList 컴포넌트 - 폴더 상세 정보 및 페이지 리스트 (모달)
export function FolderDetailPageList() {
    const { folderId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const { goBack } = useNavigation();
    const [folder, setFolder] = useState<any>(null);
    const t = useTranslations('folder');
    const tCommon = useTranslations();
    const refreshList = useSetAtom(refreshListState);
    const openConfirm = useSetAtom(openConfirmState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const refreshFolders = useRefreshFolders();

    // 편집/삭제 UI 상태
    const [isEditingFolder, setIsEditingFolder] = useState(false);
    const [editFolderName, setEditFolderName] = useState('');
    const [isSavingFolder, setIsSavingFolder] = useState(false);
    const [isDeletingFolder, setIsDeletingFolder] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const isMenuOpen = Boolean(menuAnchorEl);
    enhancedRenderLogger('FolderDetailPageList', { folderId, location });

    // 컴포넌트 마운트 시 상태 설정
    useEffect(
        function initializeFolderDetailState() {
            setCurrentPage({
                type: 'FOLDER',
                id: folderId || null,
                path: `/home/folder/${folderId}`,
            });
            folderLogger('폴더 상세 페이지 진입', { folderId });
        },
        [folderId, setCurrentPage]
    );

    // 폴더 정보만 로드 (페이지 목록은 PageContainer가 처리)
    useEffect(
        function loadFolderInfo() {
            if (!folderId) return;

            const loadFolder = async () => {
                try {
                    folderLogger('폴더 정보 로드 시작', { folderId });

                    // 폴더 목록에서 해당 폴더 찾기
                    const allFolders = await getFolders();
                    const targetFolder = allFolders.find((f) => f.id === folderId);

                    if (!targetFolder) {
                        folderLogger('폴더를 찾을 수 없음', { folderId });
                        setFolder(null);
                        return;
                    }

                    setFolder(targetFolder);

                    // 폴더명을 currentPage extraData에 추가하여 브라우저 타이틀 업데이트
                    setCurrentPage({
                        type: 'FOLDER',
                        id: folderId,
                        path: `/home/folder/${folderId}`,
                        extraData: { folderName: targetFolder.name },
                    });

                    folderLogger('폴더 정보 로드 완료', {
                        folderId,
                        folderName: targetFolder.name,
                    });
                } catch (error) {
                    folderLogger('폴더 정보 로드 실패', { folderId, error });
                    Sentry.captureException(error);
                    setFolder(null);
                }
            };

            loadFolder();
        },
        [folderId, setCurrentPage]
    );

    // 페이지 선택 핸들러
    const handlePageSelect = useCallback(
        (id: string, type: string) => {
            folderLogger('폴더 내 페이지 선택', { pageId: id, folderId });
            navigate(`${id}`);
        },
        [navigate, folderId]
    );

    // 폴더 페이지 fetcher 함수
    const fetcher = useCallback(
        async (params: {
            rangeStart: number;
            rangeEnd: number;
            sortingKey: string;
            sortCriteria: 'asc' | 'desc';
            keyword?: string | null;
        }) => {
            if (!folderId) return [];

            folderLogger('폴더 페이지 fetcher 호출 (Page.list 사용)', { folderId, params });

            // WatermelonDB의 Page.list 함수를 사용하여 데이터 조회
            const pages = await listPages({
                ...params,
                searchKeyword: params.keyword ?? null,
                folderId: folderId,
            });

            // 페이지 데이터 매핑 (createdAt -> created_at 등 필드명 통일)
            const mappedPages = pages.map((page: any) => ({
                id: page.id,
                title: page.title,
                body: page.body,
                createdAt: page.createdAt, // wmdb 모델은 createdAt을 사용
                img_url: page.img_url,
                length: page.length,
                type: page.type,
                folder_id: page.folder_id,
            }));

            folderLogger('폴더 페이지 fetcher 완료', {
                folderId,
                returnedPages: mappedPages.length,
            });

            return mappedPages;
        },
        [folderId]
    );

    // 메뉴 열기/닫기
    const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setMenuAnchorEl(event.currentTarget);
    }, []);

    const handleMenuClose = useCallback(() => {
        setMenuAnchorEl(null);
    }, []);

    // 폴더명 편집 시작/취소
    const handleStartEditFolder = useCallback(() => {
        if (folder) {
            setIsEditingFolder(true);
            setEditFolderName(folder.name || '');
        }
    }, [folder]);

    const handleCancelEditFolder = useCallback(() => {
        setIsEditingFolder(false);
        setEditFolderName('');
    }, []);

    // 폴더 저장
    const handleSaveFolder = useCallback(async () => {
        if (!folder || !(editFolderName || '').trim()) return;

        try {
            folderLogger('폴더명 저장 시작', { folderId: folder.id, name: editFolderName });
            setIsSavingFolder(true);

            const { updateFolder } = await import('@/functions/folder');
            const updatedFolder = await updateFolder(folder.id, {
                name: (editFolderName || '').trim(),
            });

            setFolder(updatedFolder);
            setIsEditingFolder(false);
            setEditFolderName('');

            // 브라우저 타이틀 업데이트를 위해 currentPage extraData 갱신
            setCurrentPage({
                type: 'FOLDER',
                id: folder.id,
                path: `/home/folder/${folder.id}`,
                extraData: { folderName: updatedFolder.name },
            });

            // 다른 UI 컴포넌트 갱신
            refreshList({
                source: 'components/home2/sections/folder/Section/handleSaveFolder',
            });
            refreshFolders();
            folderLogger('폴더명 저장 완료', { folderId: folder.id });
        } catch (error) {
            folderLogger('폴더명 저장 실패', { folderId: folder?.id, error });
            Sentry.captureException(error);
        } finally {
            setIsSavingFolder(false);
        }
    }, [folder, editFolderName, refreshList, refreshFolders, setCurrentPage]);

    // 폴더 삭제
    const handleDeleteFolder = useCallback(() => {
        if (!folder || isDeletingFolder) return;

        openConfirm({
            message:
                t('confirm-delete') ||
                '정말 이 폴더를 삭제하시겠습니까?\n\n폴더가 삭제되면 폴더 안의 페이지들은 폴더 없음 상태로 변경됩니다.',
            yesLabel: t('delete') || '삭제',
            noLabel: t('cancel') || '취소',
            onYes: async () => {
                try {
                    folderLogger('폴더 삭제 시작', { folderId: folder.id });
                    setIsDeletingFolder(true);

                    const { deleteFolder } = await import('@/functions/folder');
                    await deleteFolder(folder.id);

                    openSnackbar({
                        message: t('folder-deleted') || '폴더가 삭제되었습니다.',
                        severity: 'success',
                    });

                    refreshList({
                        source: 'components/home2/sections/folder/Section/handleDeleteFolder',
                    });
                    refreshFolders();

                    // 폴더 목록으로 이동
                    navigate('/folder');
                    requestHapticFeedback();
                    folderLogger('폴더 삭제 완료', { folderId: folder.id });
                } catch (error) {
                    openSnackbar({
                        message: t('delete-failed') || '폴더 삭제에 실패했습니다.',
                        severity: 'error',
                    });
                    folderLogger('폴더 삭제 실패', { folderId: folder?.id, error });
                    Sentry.captureException(error);
                } finally {
                    setIsDeletingFolder(false);
                }
            },
            onNo: () => {
                // 취소
            },
        });
    }, [
        folder,
        isDeletingFolder,
        openConfirm,
        openSnackbar,
        t,
        refreshList,
        refreshFolders,
        navigate,
    ]);

    const handleMenuAction = useCallback(
        (action: 'edit' | 'delete') => {
            switch (action) {
                case 'edit':
                    handleStartEditFolder();
                    break;
                case 'delete':
                    handleDeleteFolder();
                    break;
            }
            handleMenuClose();
        },
        [handleStartEditFolder, handleDeleteFolder, handleMenuClose]
    );

    return (
        <SwipeableModal zIndex={Z_INDEX.FOLDER_DETAIL_PAGE_LIST_MODAL}>
            <div className="flex flex-col h-full p-4 ">
                {/* 헤더 - 제목 및 액션 */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center w-full">
                        <FolderOpenIcon className="w-5 h-5 mr-2 " />
                        {isEditingFolder ? (
                            <TextField
                                value={editFolderName}
                                onChange={(e) => setEditFolderName(e.target.value)}
                                onKeyDown={(e: React.KeyboardEvent) => {
                                    if (e.key === 'Enter' && !isSavingFolder) {
                                        handleSaveFolder();
                                    } else if (e.key === 'Escape') {
                                        handleCancelEditFolder();
                                    }
                                }}
                                size="small"
                                className="flex-grow"
                                variant="standard"
                                disabled={isSavingFolder}
                                autoFocus
                                sx={{
                                    '& .MuiInput-root': {
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        minHeight: '30.75px',
                                        lineHeight: 1.6,
                                        backgroundColor:
                                            'var(--focus-bg-color, rgba(0, 0, 0, 0.04))',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        '&:before': { display: 'none' },
                                        '&:after': { display: 'none' },
                                        '&:hover:not(.Mui-disabled):before': { display: 'none' },
                                    },
                                    '& .MuiInput-input': { padding: 0 },
                                }}
                            />
                        ) : (
                            <h2 className="text-lg font-bold">{folder?.name || '폴더 상세'}</h2>
                        )}
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                        {isEditingFolder ? (
                            <>
                                <Button
                                    size="small"
                                    onClick={handleSaveFolder}
                                    disabled={isSavingFolder || !(editFolderName || '').trim()}
                                >
                                    {isSavingFolder ? (
                                        <CircularProgress size={16} />
                                    ) : (
                                        tCommon('common.apply') || '적용'
                                    )}
                                </Button>
                                <Button
                                    size="small"
                                    onClick={handleCancelEditFolder}
                                    disabled={isSavingFolder}
                                >
                                    {tCommon('common.cancel') || '취소'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <IconButton
                                    size="small"
                                    className="text-gray-600"
                                    onClick={handleMenuOpen}
                                    disabled={!folder}
                                    title={t('folder-actions') || '폴더 관리'}
                                >
                                    <EllipsisHorizontalCircleIcon className="w-5 h-5" />
                                </IconButton>
                                <Menu
                                    anchorEl={menuAnchorEl}
                                    open={isMenuOpen}
                                    onClose={handleMenuClose}
                                    TransitionComponent={Fade}
                                    PaperProps={{
                                        elevation: 0,
                                        sx: {
                                            overflow: 'hidden',
                                            borderRadius: '15px',
                                            boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.12)',
                                            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                            minWidth: 160,
                                        },
                                    }}
                                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                    sx={{ '*': { fontSize: '0.9rem' } }}
                                >
                                    <MenuItem onClick={() => handleMenuAction('edit')}>
                                        <PencilSquareIcon className="w-4 h-4 mr-2" />
                                        {t('edit-folder-name') || '폴더명 수정'}
                                    </MenuItem>
                                    <MenuItem onClick={() => handleMenuAction('delete')}>
                                        <TrashIcon className="w-4 h-4 mr-2" />
                                        {t('delete-folder') || '폴더 삭제'}
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                    </div>
                </div>
                <TopControls
                    contentTypeSwitcher={false}
                    selection={true}
                    sort={true}
                    listType={true}
                />
                <div className="flex-1 py-2 pb-[80px]">
                    <PageContainer fetcher={fetcher} onSelect={handlePageSelect} />
                </div>
            </div>
            <Outlet />
        </SwipeableModal>
    );
}
