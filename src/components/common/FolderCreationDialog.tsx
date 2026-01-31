'use client';

import React, { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import {
    folderCreationDialogState,
    closeFolderCreationDialogState,
    openSnackbarState,
    refreshListState,
} from '@/lib/jotai';
import { createFolder } from '@/functions/folder';
import { folderLogger } from '@/debug/folder';
import { useRefreshFolders } from '@/hooks/useFoldersData';

// 다이얼로그 브레이크포인트 - 모바일에서 전체화면
const DIALOG_BREAKPOINT = 'sm';

// 폴더명 최대 길이
const FOLDER_NAME_MAX_LENGTH = 50;

// 폴더 설명 최대 길이
const FOLDER_DESC_MAX_LENGTH = 200;

export default function FolderCreationDialog() {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down(DIALOG_BREAKPOINT));
    const t = useTranslations('folder');
    const tCommon = useTranslations('common');

    const [dialogState] = useAtom(folderCreationDialogState);
    const closeDialog = useSetAtom(closeFolderCreationDialogState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const refreshList = useSetAtom(refreshListState);
    const refreshFolders = useRefreshFolders();

    const [folderName, setFolderName] = useState('');
    const [folderDescription, setFolderDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // 폴더 생성
    const handleCreateFolder = useCallback(async () => {
        if (!folderName.trim()) {
            openSnackbar({
                message: t('enter-folder-name') || '폴더명을 입력해주세요.',
                severity: 'warning',
            });
            return;
        }

        try {
            setIsCreating(true);
            folderLogger('폴더 생성 다이얼로그 - 폴더 생성 시작', { name: folderName });

            const newFolder = await createFolder(folderName.trim());

            // 폴더 생성 후 상태 갱신
            refreshList({
                source: 'components/common/FolderCreationDialog/createFolder',
            });
            refreshFolders(); // 전역 폴더 데이터 새로고침

            // 성공 콜백 호출
            if (dialogState.onSuccess) {
                dialogState.onSuccess(newFolder.id);
            }

            openSnackbar({
                message: t('folder-created') || '폴더가 생성되었습니다.',
                severity: 'success',
            });

            // 다이얼로그 닫기
            closeDialog();
            setFolderName('');

            folderLogger('폴더 생성 다이얼로그 - 폴더 생성 완료', { folder: newFolder });
        } catch (error) {
            folderLogger('폴더 생성 다이얼로그 - 폴더 생성 실패', { error });
            openSnackbar({
                message: t('create-failed') || '폴더 생성에 실패했습니다.',
                severity: 'error',
            });
        } finally {
            setIsCreating(false);
        }
    }, [folderName, t, openSnackbar, refreshList, dialogState, closeDialog, refreshFolders]);

    // 폴더명 입력 시 엔터 키 처리
    const handleFolderNameKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !isCreating) {
                handleCreateFolder();
            } else if (e.key === 'Escape') {
                closeDialog();
                setFolderName('');
            }
        },
        [isCreating, handleCreateFolder, closeDialog]
    );

    // 다이얼로그 닫기
    const handleClose = useCallback(() => {
        if (isCreating) return; // 생성 중일 때는 닫기 불가

        folderLogger('폴더 생성 다이얼로그 닫기');
        closeDialog();
        setFolderName('');
    }, [closeDialog, isCreating]);

    if (!dialogState.open) return null;

    return (
        <Dialog
            open={dialogState.open}
            onClose={handleClose}
            fullScreen={fullScreen}
            maxWidth="sm"
            fullWidth
        >
            <DialogContent sx={{ py: 5 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '120px',
                        gap: 3,
                    }}
                >
                    {/* 가운데 텍스트 필드 */}
                    <TextField
                        placeholder={t('enter-folder-name') || '폴더명을 입력하세요...'}
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        onKeyDown={handleFolderNameKeyDown}
                        variant="outlined"
                        disabled={isCreating}
                        autoFocus
                        fullWidth
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                '& fieldset': {
                                    borderColor: 'divider',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'primary.main',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'primary.main',
                                },
                            },
                            '& .MuiInputBase-input': {
                                padding: '16px',
                                fontSize: '1rem',
                                textAlign: 'center',
                            },
                        }}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleClose}
                    disabled={isCreating}
                >
                    {t('cancel') || '취소'}
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleCreateFolder}
                    disabled={isCreating || !folderName.trim()}
                    startIcon={isCreating ? <CircularProgress size={16} /> : undefined}
                >
                    {isCreating ? t('creating') || '생성 중...' : t('create') || '생성'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
