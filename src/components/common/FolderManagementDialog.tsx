'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Radio from '@mui/material/Radio';
import {
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    CheckIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
    folderManagementDialogState,
    closeFolderManagementDialogState,
    openSnackbarState,
    refreshListState,
    openFolderCreationDialogState,
    selectedItemsState,
} from '@/lib/jotai';
import {
    getFolders,
    updateFolder,
    deleteFolder,
    addPageToFolder,
    addPagesToFolder,
    getPageFolder,
    type Folder,
    createFolder,
} from '@/functions/folder';
import { folderLogger } from '@/debug/folder';
import { useRefreshFolders } from '@/hooks/useFoldersData';

const DIALOG_BREAKPOINT = 'sm';

export default function FolderManagementDialog() {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down(DIALOG_BREAKPOINT));
    const t = useTranslations('folder');
    const tCommon = useTranslations('common');
    const router = useRouter();

    const [dialogState] = useAtom(folderManagementDialogState);
    const closeDialog = useSetAtom(closeFolderManagementDialogState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const refreshList = useSetAtom(refreshListState);
    const openFolderCreationDialog = useSetAtom(openFolderCreationDialogState);
    const setSelectedItems = useSetAtom(selectedItemsState);
    const refreshFolders = useRefreshFolders();

    const [folders, setFolders] = useState<Folder[]>([]);
    const [currentPageFolder, setCurrentPageFolder] = useState<Folder | null>(null);
    const [loading, setLoading] = useState(false);
    const [editingFolder, setEditingFolder] = useState<string | null>(null);
    const [editFolderName, setEditFolderName] = useState('');

    // 폴더 생성 모드 상태 추가
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isSubmittingNewFolder, setIsSubmittingNewFolder] = useState(false);

    // 다중 페이지 모드인지 확인
    const isMultipleMode = dialogState.multiplePageIds && dialogState.multiplePageIds.length > 1;

    // 디버깅용 로그
    useEffect(() => {
        folderLogger('다이얼로그 상태 변경', {
            open: dialogState.open,
            currentPageId: dialogState.currentPageId,
            multiplePageIds: dialogState.multiplePageIds,
            multiplePageIdsLength: dialogState.multiplePageIds?.length,
            isMultipleMode,
        });
    }, [dialogState, isMultipleMode]);

    // 폴더 목록 로드
    const loadFolders = useCallback(async () => {
        try {
            setLoading(true);
            folderLogger('폴더 목록 로드 시작');

            if (!isMultipleMode && dialogState.currentPageId) {
                // 개별 페이지 모드에서는 현재 폴더 정보도 로드
                const [foldersData, currentFolder] = await Promise.all([
                    getFolders(),
                    getPageFolder(dialogState.currentPageId),
                ]);

                setFolders(foldersData);
                setCurrentPageFolder(currentFolder);

                folderLogger('폴더 목록 로드 완료', {
                    foldersCount: foldersData.length,
                    currentFolder: currentFolder?.name,
                });
            } else {
                // 다중 선택 모드에서는 폴더 목록만 로드
                const foldersData = await getFolders();
                setFolders(foldersData);

                folderLogger('폴더 목록 로드 완료', {
                    foldersCount: foldersData.length,
                });
            }
        } catch (error) {
            folderLogger('폴더 목록 로드 실패', { error });
            openSnackbar({
                message: t('load-failed') || '폴더 목록을 불러오는데 실패했습니다.',
                severity: 'error',
            });
        } finally {
            setLoading(false);
        }
    }, [dialogState.currentPageId, isMultipleMode, t, openSnackbar]);

    // 다이얼로그가 열릴 때 폴더 목록 로드 및 상태 초기화
    useEffect(
        function loadFoldersOnOpen() {
            if (dialogState.open) {
                folderLogger('다이얼로그 열기 - 초기 상태', {
                    currentPageId: dialogState.currentPageId,
                    isMultipleMode,
                });
                loadFolders();
                setEditingFolder(null);
                setIsCreatingFolder(false); // 생성 모드 초기화
                setNewFolderName('');
                folderLogger('다이얼로그 열기 - 상태 초기화 완료');
            }
        },
        [dialogState.open, loadFolders, isMultipleMode]
    );

    // 새 폴더 생성 다이얼로그 열기
    const handleCreateFolder = useCallback(() => {
        folderLogger('새 폴더 생성 모드 진입');
        setIsCreatingFolder(true);
        setNewFolderName('');
        setEditingFolder(null); // 기존 편집 모드 취소
    }, []);

    // 폴더 생성 취소
    const handleCancelCreateFolder = useCallback(() => {
        setIsCreatingFolder(false);
        setNewFolderName('');
    }, []);

    // 폴더 생성 제출
    const handleSubmitNewFolder = useCallback(async () => {
        if (!newFolderName.trim()) {
            openSnackbar({
                message: t('enter-folder-name') || '폴더명을 입력해주세요.',
                severity: 'warning',
            });
            return;
        }

        try {
            setIsSubmittingNewFolder(true);
            folderLogger('폴더 생성 시작', { name: newFolderName });

            const newFolder = await createFolder(newFolderName.trim());

            // 폴더 목록 새로고침
            await loadFolders();

            refreshList({
                source: 'components/common/FolderManagementDialog/createFolder',
            });
            refreshFolders();

            openSnackbar({
                message: t('folder-created') || '폴더가 생성되었습니다.',
                severity: 'success',
            });

            // 생성 모드 종료
            setIsCreatingFolder(false);
            setNewFolderName('');

            folderLogger('폴더 생성 완료', { folder: newFolder });
        } catch (error) {
            folderLogger('폴더 생성 실패', { error });
            openSnackbar({
                message: t('create-failed') || '폴더 생성에 실패했습니다.',
                severity: 'error',
            });
        } finally {
            setIsSubmittingNewFolder(false);
        }
    }, [newFolderName, t, openSnackbar, loadFolders, refreshList, refreshFolders]);

    // 폴더 수정 (개별 페이지 모드에서만 사용)
    const handleUpdateFolder = useCallback(
        async (folderId: string) => {
            if (!editFolderName.trim()) {
                openSnackbar({
                    message: t('enter-folder-name') || '폴더명을 입력해주세요.',
                    severity: 'warning',
                });
                return;
            }

            try {
                folderLogger('폴더 수정 시작', { folderId, name: editFolderName });

                const updatedFolder = await updateFolder(folderId, {
                    name: editFolderName.trim(),
                });

                setFolders((prev) =>
                    prev.map((folder) => (folder.id === folderId ? updatedFolder : folder))
                );

                setEditingFolder(null);
                setEditFolderName('');

                // 현재 페이지의 폴더가 수정된 경우 로컬 상태 업데이트
                if (currentPageFolder?.id === folderId) {
                    setCurrentPageFolder(updatedFolder);
                }

                refreshList({
                    source: 'components/common/FolderManagementDialog/updateFolder',
                });
                refreshFolders();

                openSnackbar({
                    message: t('folder-updated') || '폴더가 수정되었습니다.',
                    severity: 'success',
                });

                folderLogger('폴더 수정 완료', { updatedFolder });
            } catch (error) {
                folderLogger('폴더 수정 실패', { error });
                openSnackbar({
                    message: t('update-failed') || '폴더 수정에 실패했습니다.',
                    severity: 'error',
                });
            }
        },
        [editFolderName, currentPageFolder, t, openSnackbar, refreshList, refreshFolders]
    );

    // 폴더 삭제 (개별 페이지 모드에서만 사용)
    const handleDeleteFolder = useCallback(
        async (folderId: string, folderName: string) => {
            try {
                folderLogger('폴더 삭제 시작', { folderId, folderName });

                await deleteFolder(folderId);

                setFolders((prev) => prev.filter((folder) => folder.id !== folderId));

                // 현재 페이지가 삭제된 폴더에 있었다면 폴더 정보 초기화
                if (currentPageFolder?.id === folderId) {
                    setCurrentPageFolder(null);
                }

                refreshList({
                    source: 'components/common/FolderManagementDialog/deleteFolder',
                });
                refreshFolders();

                openSnackbar({
                    message: t('folder-deleted') || '폴더가 삭제되었습니다.',
                    severity: 'success',
                });

                folderLogger('폴더 삭제 완료', { folderId });
            } catch (error) {
                folderLogger('폴더 삭제 실패', { error });
                openSnackbar({
                    message: t('delete-failed') || '폴더 삭제에 실패했습니다.',
                    severity: 'error',
                });
            }
        },
        [currentPageFolder, t, openSnackbar, refreshList, refreshFolders]
    );

    // 페이지를 폴더에 추가/제거 (개별 페이지 모드에서 사용)
    const handleTogglePageFolder = useCallback(
        async (folderId: string | null) => {
            if (!dialogState.currentPageId) return;

            try {
                folderLogger('페이지 폴더 토글 시작', {
                    pageId: dialogState.currentPageId,
                    folderId,
                });

                // 이전 폴더 ID 저장 (정렬 유지를 위해)
                const previousFolderId = currentPageFolder?.id || null;

                await addPageToFolder(dialogState.currentPageId, folderId);

                // 현재 페이지 폴더 상태 업데이트
                if (folderId) {
                    const folder = folders.find((f) => f.id === folderId);
                    setCurrentPageFolder(folder || null);
                } else {
                    setCurrentPageFolder(null);
                }

                // 로컬 상태에서 관련 폴더의 page_count만 업데이트 (정렬 유지)
                setFolders((prevFolders) => {
                    return prevFolders.map((folder) => {
                        // 이전 폴더에서 제거되는 경우
                        if (
                            previousFolderId &&
                            folder.id === previousFolderId &&
                            folderId !== previousFolderId
                        ) {
                            return {
                                ...folder,
                                page_count: Math.max(0, (folder.page_count || 0) - 1),
                            };
                        }
                        // 새 폴더에 추가되는 경우
                        if (folderId && folder.id === folderId && previousFolderId !== folderId) {
                            return {
                                ...folder,
                                page_count: (folder.page_count || 0) + 1,
                            };
                        }
                        return folder;
                    });
                });

                // 외과수술적 업데이트는 addPageToFolder 함수 내부에서 처리됨
                // refreshList 호출 제거 (중복 방지)

                // 전역 폴더 데이터 새로고침
                setTimeout(() => {
                    refreshFolders();
                }, 100);

                folderLogger('페이지 폴더 토글 완료', {
                    pageId: dialogState.currentPageId,
                    folderId,
                });
            } catch (error) {
                folderLogger('페이지 폴더 토글 실패', { error });

                let errorMessage = t('toggle-failed') || '작업에 실패했습니다.';
                if (error instanceof Error) {
                    if (error.message.includes('not found')) {
                        errorMessage =
                            t('folder-not-found') || '폴더를 찾을 수 없습니다. 다시 시도해주세요.';
                    }
                }

                openSnackbar({
                    message: errorMessage,
                    severity: 'error',
                });
            }
        },
        [dialogState.currentPageId, folders, currentPageFolder, t, openSnackbar, refreshFolders]
    );

    // 페이지를 폴더에 추가하고 해당 폴더로 이동 (다중 선택 모드에서 사용)
    const handleAddToFolderAndNavigate = useCallback(
        async (folderId: string | null) => {
            if (!dialogState.currentPageId && !dialogState.multiplePageIds) return;

            try {
                const pageIds = isMultipleMode
                    ? dialogState.multiplePageIds!
                    : [dialogState.currentPageId!];

                folderLogger('페이지 폴더 추가 시작', {
                    pageIds,
                    folderId,
                    isMultipleMode,
                });

                // 모든 페이지에 폴더 적용
                if (isMultipleMode) {
                    await addPagesToFolder(pageIds, folderId);
                    // 외과수술적 업데이트는 addPagesToFolder 함수 내부에서 처리됨
                    // refreshList 호출 제거 (중복 방지)
                } else {
                    await addPageToFolder(pageIds[0], folderId);
                    // 외과수술적 업데이트는 addPageToFolder 함수 내부에서 처리됨
                }

                // 전역 폴더 데이터 새로고침
                setTimeout(() => {
                    refreshFolders();
                }, 100);

                folderLogger('페이지 폴더 추가 완료', { pageIds, folderId, isMultipleMode });

                // 다이얼로그 닫기
                closeDialog();

                // 다중 선택 모드에서는 선택 항목만 초기화 (선택 모드는 유지)
                if (isMultipleMode) {
                    setTimeout(() => {
                        // 선택된 항목만 초기화하고 선택 모드는 유지
                        setSelectedItems(new Set<string>());
                    }, 100);
                }
            } catch (error) {
                folderLogger('페이지 폴더 추가 실패', { error });

                let errorMessage = t('toggle-failed') || '작업에 실패했습니다.';
                if (error instanceof Error) {
                    if (error.message.includes('not found')) {
                        errorMessage =
                            t('folder-not-found') || '폴더를 찾을 수 없습니다. 다시 시도해주세요.';
                    }
                }

                openSnackbar({
                    message: errorMessage,
                    severity: 'error',
                });
            }
        },
        [
            dialogState.currentPageId,
            dialogState.multiplePageIds,
            isMultipleMode,
            t,
            openSnackbar,
            closeDialog,
            refreshFolders,
            router,
            setSelectedItems,
        ]
    );

    // 편집 시작
    const handleStartEdit = useCallback((folder: Folder) => {
        setEditingFolder(folder.id);
        setEditFolderName(folder.name || '');
    }, []);

    // 편집 취소
    const handleCancelEdit = useCallback(() => {
        setEditingFolder(null);
        setEditFolderName('');
    }, []);

    // 다이얼로그 닫기
    const handleClose = useCallback(() => {
        folderLogger('다이얼로그 닫기 - 상태 초기화');
        closeDialog();
        setEditingFolder(null);
        setEditFolderName('');
        setIsCreatingFolder(false);
        setNewFolderName('');
        folderLogger('다이얼로그 닫기 완료');
    }, [closeDialog]);

    if (!dialogState.open) return null;

    return (
        <Dialog
            open={dialogState.open}
            onClose={handleClose}
            fullScreen={fullScreen}
            maxWidth="sm"
            fullWidth
        >
            <DialogContent sx={{ px: 3 }}>
                <Box>
                    {/* 사용자 안내 메시지 */}

                    {/* 폴더 생성 버튼 또는 생성 입력 폼 */}
                    <Box sx={{ mb: 2, minHeight: 80, display: 'flex', alignItems: 'center' }}>
                        {!isCreatingFolder ? (
                            <Box sx={{ width: '100%' }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<PlusIcon className="w-6 h-6" />}
                                    onClick={handleCreateFolder}
                                    disabled={editingFolder !== null}
                                    fullWidth
                                    sx={{
                                        textAlign: 'center',
                                        py: 1.5,
                                        fontSize: '1rem',
                                        borderRadius: 10,
                                        height: 48,
                                    }}
                                >
                                    {t('create-folder') || '폴더 생성'}
                                </Button>
                            </Box>
                        ) : (
                            // 폴더 생성 입력 폼 - 폴더 수정 UI와 동일한 스타일
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    p: 1,
                                    borderRadius: 1,
                                    width: '100%',
                                    height: 48,
                                }}
                            >
                                <TextField
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !isSubmittingNewFolder) {
                                            handleSubmitNewFolder();
                                        } else if (e.key === 'Escape') {
                                            handleCancelCreateFolder();
                                        }
                                    }}
                                    placeholder={t('folder-name-placeholder')}
                                    size="small"
                                    variant="standard"
                                    autoFocus
                                    disabled={isSubmittingNewFolder}
                                    sx={{
                                        flex: 1,
                                        '& .MuiInput-underline:before': { borderBottom: 'none' },
                                        '& .MuiInput-underline:after': { borderBottom: 'none' },
                                        '& .MuiInput-underline:hover:not(.Mui-disabled):before': {
                                            borderBottom: 'none',
                                        },
                                        '& .MuiInputBase-input': {
                                            backgroundColor: 'action.focus',
                                            borderRadius: 1,
                                            padding: '8px 12px',
                                        },
                                    }}
                                />
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', ml: 1 }}>
                                    <IconButton
                                        size="small"
                                        onClick={handleSubmitNewFolder}
                                        disabled={!newFolderName.trim() || isSubmittingNewFolder}
                                    >
                                        {isSubmittingNewFolder ? (
                                            <CircularProgress size={16} />
                                        ) : (
                                            <CheckIcon className="w-5 h-5" />
                                        )}
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={handleCancelCreateFolder}
                                        disabled={isSubmittingNewFolder}
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </IconButton>
                                </Box>
                            </Box>
                        )}
                    </Box>

                    <Box sx={{ mb: 2 }}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                textAlign: 'left',
                                fontSize: '0.875rem',
                                lineHeight: 1.4,
                                px: 1,
                            }}
                        >
                            {isMultipleMode
                                ? t('select-folder-instruction-multiple', {
                                      count: dialogState.multiplePageIds?.length || 0,
                                  })
                                : t('select-folder-instruction')}
                        </Typography>
                    </Box>

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <List dense>
                            {/* 다중 선택 모드에서만 지정안함 항목 표시 */}
                            {isMultipleMode && (
                                <ListItem
                                    disablePadding
                                    sx={{
                                        borderRadius: 1,
                                        mb: 1,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            bgcolor: 'action.selected',
                                        },
                                        transition: 'background 0.2s',
                                        height: '55px',
                                    }}
                                    onClick={() => handleAddToFolderAndNavigate(null)}
                                >
                                    <Box
                                        sx={{
                                            width: '100%',
                                            p: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontSize: '1rem' }}
                                                >
                                                    {t('no-folder') || '지정안함'}
                                                </Typography>
                                            }
                                        />
                                    </Box>
                                </ListItem>
                            )}

                            {/* 개별 페이지 모드에서만 지정안함 항목 표시 (라디오 버튼 포함) */}
                            {!isMultipleMode && dialogState.currentPageId && (
                                <ListItem
                                    disablePadding
                                    sx={{
                                        bgcolor: !currentPageFolder
                                            ? 'action.selected'
                                            : 'transparent',
                                        borderRadius: 1,
                                        mb: 1,
                                        cursor: 'pointer',
                                        '&:hover': {
                                            bgcolor: 'action.selected',
                                        },
                                        transition: 'background 0.2s',
                                    }}
                                    onClick={() => {
                                        if (editingFolder !== null) return;

                                        if (!currentPageFolder) {
                                            closeDialog();
                                            return;
                                        }

                                        handleTogglePageFolder(null);
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: '100%',
                                            p: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            <Radio
                                                checked={!currentPageFolder}
                                                color="primary"
                                                size="small"
                                                sx={{
                                                    color: 'text.primary',
                                                    '&.Mui-checked': {
                                                        color: 'primary.main',
                                                    },
                                                }}
                                            />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontSize: '1rem' }}
                                                >
                                                    {t('no-folder') || '지정안함'}
                                                </Typography>
                                            }
                                        />
                                    </Box>
                                </ListItem>
                            )}

                            {/* 폴더 목록 */}
                            {folders.length === 0 ? (
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: '200px',
                                        py: 4,
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ textAlign: 'center' }}
                                    >
                                        {t('no-folders') || '생성된 폴더가 없습니다.'}
                                    </Typography>
                                </Box>
                            ) : (
                                folders.map((folder) => (
                                    <ListItem
                                        key={folder.id}
                                        disablePadding
                                        sx={{
                                            bgcolor:
                                                !isMultipleMode &&
                                                currentPageFolder?.id === folder.id
                                                    ? 'action.selected'
                                                    : 'transparent',
                                            borderRadius: 1,
                                            mb: 1,
                                            cursor:
                                                editingFolder === folder.id ? 'default' : 'pointer',
                                            '&:hover': {
                                                bgcolor: 'action.selected',
                                            },
                                            transition: 'background 0.2s',
                                            height: '55px',
                                        }}
                                        onClick={() => {
                                            if (editingFolder !== null) return;

                                            if (isMultipleMode) {
                                                // 다중 선택 모드에서는 바로 이동
                                                handleAddToFolderAndNavigate(folder.id);
                                            } else if (dialogState.currentPageId) {
                                                // 개별 페이지 모드에서는 토글
                                                if (currentPageFolder?.id === folder.id) {
                                                    handleTogglePageFolder(null);
                                                } else {
                                                    handleTogglePageFolder(folder.id);
                                                }
                                            }
                                        }}
                                    >
                                        {editingFolder === folder.id ? (
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <TextField
                                                    value={editFolderName}
                                                    onChange={(e) =>
                                                        setEditFolderName(e.target.value)
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleUpdateFolder(folder.id);
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    size="small"
                                                    variant="standard"
                                                    autoFocus
                                                    sx={{
                                                        flex: 1,
                                                        '& .MuiInput-underline:before': {
                                                            borderBottom: 'none',
                                                        },
                                                        '& .MuiInput-underline:after': {
                                                            borderBottom: 'none',
                                                        },
                                                        '& .MuiInput-underline:hover:not(.Mui-disabled):before':
                                                            { borderBottom: 'none' },
                                                        '& .MuiInputBase-input': {
                                                            backgroundColor: 'action.focus',
                                                            borderRadius: 1,
                                                            padding: '8px 12px',
                                                        },
                                                    }}
                                                />
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        ml: 1,
                                                    }}
                                                >
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            handleUpdateFolder(folder.id)
                                                        }
                                                        disabled={!editFolderName.trim()}
                                                    >
                                                        <CheckIcon className="w-5 h-5" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={handleCancelEdit}
                                                    >
                                                        <XMarkIcon className="w-5 h-5" />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    p: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                }}
                                            >
                                                {!isMultipleMode && dialogState.currentPageId && (
                                                    <ListItemIcon sx={{ minWidth: 32 }}>
                                                        <Radio
                                                            checked={
                                                                currentPageFolder?.id === folder.id
                                                            }
                                                            color="primary"
                                                            size="small"
                                                            sx={{
                                                                color: 'text.primary',
                                                                '&.Mui-checked': {
                                                                    color: 'primary.main',
                                                                },
                                                            }}
                                                        />
                                                    </ListItemIcon>
                                                )}
                                                <ListItemText
                                                    primary={
                                                        <Typography
                                                            variant="body1"
                                                            sx={{ fontSize: '1rem' }}
                                                        >
                                                            {folder.name} ({folder.page_count || 0})
                                                        </Typography>
                                                    }
                                                />
                                                {!isMultipleMode && (
                                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                        <IconButton
                                                            size="medium"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStartEdit(folder);
                                                            }}
                                                            sx={{
                                                                color: 'text.secondary',
                                                                '&:hover': {
                                                                    color: 'primary.main',
                                                                    bgcolor: 'action.hover',
                                                                },
                                                            }}
                                                        >
                                                            <PencilSquareIcon className="w-5 h-5" />
                                                        </IconButton>
                                                        <IconButton
                                                            size="medium"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteFolder(
                                                                    folder.id,
                                                                    folder.name
                                                                );
                                                            }}
                                                            sx={{
                                                                color: 'text.secondary',
                                                                '&:hover': {
                                                                    color: 'error.main',
                                                                    bgcolor: 'action.hover',
                                                                },
                                                            }}
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </IconButton>
                                                    </Box>
                                                )}
                                            </Box>
                                        )}
                                    </ListItem>
                                ))
                            )}
                        </List>
                    )}
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose} color="secondary" variant="contained">
                    {tCommon('close') || '닫기'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
