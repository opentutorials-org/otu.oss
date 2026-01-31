'use client';
import { navBottomLogger } from '@/debug/nav';
import {
    isDarkModeAtom,
    isModifiedState,
    noticeHistoryState,
    openConfirmState,
    openSnackbarState,
    refreshListState,
    runSyncState,
    searchDialogState,
    selectedItemsState,
    selectionModeState,
    openFolderManagementDialogState,
    resetSelectionState,
    refreshFoldersState,
} from '@/lib/jotai';
import { remove, get as getPage } from '@/watermelondb/control/Page';
import { deleteFolders, removePagesFromFolder, syncFolderInfoSilent } from '@/functions/folder';
import { deleteAlarmsByPageIds } from '@/watermelondb/control/Alarm';
import {
    FolderOpenIcon,
    FolderMinusIcon,
    BellSlashIcon,
    TrashIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { NavButton, NavButtonLabel } from '../NavButton';
import { useTranslations } from 'next-intl';
import { useLocation, matchPath } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';

export default function SelectionNavigation() {
    const t = useTranslations();
    const tFolder = useTranslations('folder');
    const location = useLocation();
    const pathname = location.pathname;
    const darkMode = useAtomValue(isDarkModeAtom);
    const [searchDialog] = useAtom(searchDialogState);
    const [noticeHistory] = useAtom(noticeHistoryState);
    const openConfirm = useSetAtom(openConfirmState);
    const isModified = useAtomValue(isModifiedState);
    const selectedItems = useAtomValue(selectedItemsState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const refreshList = useSetAtom(refreshListState);
    const runSync = useSetAtom(runSyncState);
    const setSelectionMode = useSetAtom(selectionModeState);
    const resetSelection = useSetAtom(resetSelectionState);
    const openFolderManagementDialog = useSetAtom(openFolderManagementDialogState);
    const setRefreshFolders = useSetAtom(refreshFoldersState);

    // URL 기반으로 섹션 구별
    const isInPageSection = pathname.startsWith('/home/page') || pathname.startsWith('/page');
    const isInFolderSection = pathname.startsWith('/home/folder') || pathname.startsWith('/folder');
    const isInReminderSection =
        pathname.startsWith('/home/reminder') || pathname.startsWith('/reminder');
    const isInSearchSection = pathname.startsWith('/home/search') || pathname.startsWith('/search');

    // URL에서 폴더 ID 추출 (matchPath 사용)
    const folderMatch =
        matchPath({ path: '/folder/:folderId/*', end: false }, pathname) ||
        matchPath({ path: '/folder/:folderId', end: true }, pathname) ||
        matchPath({ path: '/home/folder/:folderId/*', end: false }, pathname) ||
        matchPath({ path: '/home/folder/:folderId', end: true }, pathname);
    const currentFolderId = folderMatch?.params?.folderId ?? null;

    const isFolderList = isInFolderSection && !currentFolderId;
    const isFolderDetail = isInFolderSection && !!currentFolderId;

    navBottomLogger('하단 네비 랜더링', {
        darkMode,
        searchDialog,
        noticeHistory,
        isModified,
        pathname,
        params: { folderId: currentFolderId },
        isInPageSection,
        isInFolderSection,
        isInReminderSection,
        isInSearchSection,
        isFolderList,
        isFolderDetail,
        selectedItemsSize: selectedItems.size,
    });

    const handleDelete = () => {
        if (selectedItems.size === 0) return;

        const confirmMessage = isFolderList
            ? tFolder('confirm-delete-multiple', { count: selectedItems.size })
            : t('editor.confirm-delete-multiple', { count: selectedItems.size });

        openConfirm({
            message: confirmMessage,
            onNo: () => {},
            yesLabel: t('read.delete'),
            noLabel: tFolder('cancel'),
            onYes: async () => {
                if (selectedItems.size > 0) {
                    try {
                        if (isFolderList) {
                            // 폴더 리스트: 선택된 폴더들 삭제
                            const folderIds = Array.from(selectedItems);
                            const { folderLogger } = await import('@/debug/folder');
                            folderLogger('[selection] 폴더 삭제 시작', { folderIds });

                            await deleteFolders(folderIds);
                            folderLogger('[selection] deleteFolders 완료');

                            // WatermelonDB 캐시 갱신 대기 후 폴더 목록 새로고침
                            folderLogger('[selection] 100ms 후 setRefreshFolders 예약');
                            setTimeout(() => {
                                folderLogger('[selection] setRefreshFolders 호출');
                                setRefreshFolders((prev) => {
                                    folderLogger('[selection] refreshFolders 값 변경', {
                                        prev,
                                        next: prev + 1,
                                    });
                                    return prev + 1;
                                });
                            }, 100);

                            openSnackbar({
                                message: tFolder('folders-deleted-multiple', {
                                    count: selectedItems.size,
                                }),
                            });
                        } else {
                            // 페이지 섹션/폴더 상세/리마인더: 선택된 페이지들 삭제
                            const pageIds = Array.from(selectedItems);

                            // 리마인더 섹션에서 삭제 시, 연관된 알람도 함께 삭제
                            if (isInReminderSection) {
                                await deleteAlarmsByPageIds(pageIds);
                            }

                            // 삭제 전 페이지들의 folder_id 수집 (폴더 정보 갱신용)
                            const affectedFolderIds = new Set<string>();
                            for (const pageId of pageIds) {
                                try {
                                    const page = await getPage(pageId);
                                    // @ts-ignore
                                    const folderId = page?.folder_id;
                                    if (folderId) {
                                        affectedFolderIds.add(folderId);
                                    }
                                } catch (error) {
                                    // 페이지 조회 실패 시 무시
                                }
                            }

                            // 페이지 삭제
                            for (const itemId of pageIds) {
                                await remove(itemId);
                            }
                            openSnackbar({ message: t('read.delete-complete') });

                            // 리마인더 섹션이 아닐 때만 sync 실행 (observe가 자동 처리)
                            if (!isInReminderSection) {
                                runSync({});
                            }

                            // 영향받은 폴더들의 정보 동기화 (페이지 수, 썸네일)
                            if (affectedFolderIds.size > 0) {
                                try {
                                    await Promise.all(
                                        Array.from(affectedFolderIds).map((folderId) =>
                                            syncFolderInfoSilent(folderId)
                                        )
                                    );
                                    // 폴더 리스트 UI 갱신
                                    setRefreshFolders((prev) => prev + 1);
                                } catch (error) {
                                    // 폴더 정보 동기화 실패해도 삭제는 완료된 상태
                                    console.error('폴더 정보 동기화 실패:', error);
                                }
                            }

                            // Page 섹션이나 Folder 상세 섹션: 외과수술적 업데이트 (배치 호출)
                            // Reminder 섹션: 전체 갱신 (외과수술적 업데이트 미지원)
                            if (isInPageSection || isFolderDetail) {
                                // 외과수술적 업데이트: 배치로 한 번만 호출
                                refreshList({
                                    source: 'components/layout/bottom/selection/index:handleDelete',
                                    pageIds: pageIds,
                                    action: 'delete',
                                });
                            } else {
                                // Reminder 섹션: 전체 갱신
                                refreshList({
                                    source: 'components/layout/bottom/selection/index:handleDelete',
                                });
                            }
                        }

                        setSelectionMode(false);
                    } catch (error) {
                        console.error('삭제 중 오류 발생:', error);
                        openSnackbar({
                            message: isFolderList
                                ? tFolder('delete-failed')
                                : t('read.delete-failed'),
                            severity: 'error',
                        });
                    }
                }
            },
        });
    };

    const handleAddToFolder = () => {
        if (selectedItems.size === 0) return;

        // 페이지 섹션 또는 검색 섹션에서 폴더에 추가 가능
        if (!isInPageSection && !isInSearchSection) return;

        const pageIds = Array.from(selectedItems);

        // 다중 페이지를 처리할 수 있도록 FolderManagementDialog를 열기
        openFolderManagementDialog({
            currentPageId: pageIds[0], // 첫 번째 페이지를 기준으로 현재 폴더 표시
            multiplePageIds: pageIds, // 모든 선택된 페이지 ID 목록
        });
    };

    const handleRemoveFromFolder = () => {
        if (selectedItems.size === 0) {
            return;
        }

        // URL에서 폴더 ID 직접 추출
        if (!currentFolderId) {
            console.error('폴더 ID를 찾을 수 없습니다.');
            return;
        }

        const pageIds = Array.from(selectedItems);
        const selectedCount = pageIds.length;

        openConfirm({
            message: tFolder('confirm-remove-pages', { count: selectedCount }),
            yesLabel: tFolder('remove-from-folder'),
            noLabel: tFolder('cancel'),
            onYes: async () => {
                try {
                    await removePagesFromFolder(pageIds, currentFolderId);

                    openSnackbar({
                        message: tFolder('pages-removed-from-folder', { count: selectedCount }),
                        severity: 'success',
                    });

                    // 선택 모드 해제
                    resetSelection();

                    // 폴더 데이터 새로고침
                    refreshList({
                        source: 'components/layout/bottom/selection/index:handleRemoveFromFolder',
                    });

                    // 강제 새로고침을 위해 약간의 지연 후 한 번 더 트리거
                    setTimeout(() => {
                        refreshList({
                            source: 'components/layout/bottom/selection/index:handleRemoveFromFolder-delayed',
                        });
                    }, 500);
                } catch (error) {
                    console.error('폴더에서 제거 중 오류 발생:', error);
                    openSnackbar({
                        message: tFolder('remove-failed'),
                        severity: 'error',
                    });
                }
            },
            onNo: () => {
                // 사용자가 취소
            },
        });
    };

    const handleTurnOffAlarms = () => {
        if (selectedItems.size === 0) return;

        // 리마인더 섹션에서만 알림 끄기 가능
        if (!isInReminderSection) return;

        const pageIds = Array.from(selectedItems);
        const confirmMessage = t('alarm.confirm-turn-off-multiple', { count: selectedItems.size });

        openConfirm({
            message: confirmMessage,
            yesLabel: t('alarm.turn-off'),
            noLabel: t('common.cancel'),
            onYes: async () => {
                try {
                    // WatermelonDB에서 직접 알람 삭제
                    const deletedCount = await deleteAlarmsByPageIds(pageIds);

                    openSnackbar({
                        message: t('alarm.turned-off-multiple', { count: deletedCount }),
                        severity: 'success',
                    });

                    // 선택 모드 해제 및 목록 새로고침
                    resetSelection();
                    refreshList({
                        source: 'components/layout/bottom/selection/index:handleTurnOffAlarms',
                    });

                    // 추가 지연 후 한 번 더 새로고침 (확실한 갱신을 위해)
                    setTimeout(() => {
                        refreshList({
                            source: 'components/layout/bottom/selection/index:handleTurnOffAlarms-delayed',
                        });
                    }, 500);
                } catch (error) {
                    console.error('알림 끄기 중 오류 발생:', error);
                    openSnackbar({
                        message: t('alarm.turn-off-failed'),
                        severity: 'error',
                    });
                }
            },
            onNo: () => {},
        });
    };

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '680px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '12px 19px 16px',
            }}
        >
            {/* 상단: 선택된 항목 수 + X 버튼 (같은 줄) */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <div className="text-[14px]" style={{ color: 'var(--selection-btn-text)' }}>
                    {t('selection.items-selected', { count: selectedItems.size })}
                </div>
                <IconButton
                    onClick={resetSelection}
                    sx={{
                        width: 32,
                        height: 32,
                        marginRight: '-8px',
                        marginTop: '-4px',
                        color: 'var(--selection-btn-text)',
                        '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                        },
                    }}
                    aria-label="선택 모드 종료"
                >
                    <XMarkIcon className="w-5 h-5" strokeWidth={2.5} />
                </IconButton>
            </div>

            {/* 하단: 액션 버튼들 */}
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                }}
            >
                {/* 폴더 상세 페이지에서 페이지 선택 모드일 때 폴더에서 제거 버튼 표시 */}
                {isFolderDetail && (
                    <Button
                        onClick={handleRemoveFromFolder}
                        disabled={selectedItems.size === 0}
                        sx={{
                            flex: 1,
                            height: 48,
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            bgcolor: 'var(--selection-btn-bg)',
                            color: 'var(--selection-btn-text)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            borderRadius: 2,
                            padding: '8px 16px',
                            '&:hover': {
                                filter: 'brightness(1.15)',
                            },
                            '&.Mui-disabled': {
                                bgcolor: 'rgba(128, 128, 128, 0.05)',
                                color: 'rgba(128, 128, 128, 0.3)',
                            },
                        }}
                    >
                        <FolderMinusIcon className="w-5 h-5" />
                        <span>{tFolder('remove-from-folder')}</span>
                    </Button>
                )}

                {/* 페이지 섹션 또는 검색 섹션에서 폴더 추가 버튼 표시 */}
                {(isInPageSection || isInSearchSection) && (
                    <Button
                        onClick={handleAddToFolder}
                        disabled={selectedItems.size === 0}
                        sx={{
                            flex: 1,
                            height: 48,
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            bgcolor: 'var(--selection-btn-bg)',
                            color: 'var(--selection-btn-text)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            borderRadius: 2,
                            padding: '8px 16px',
                            '&:hover': {
                                filter: 'brightness(1.15)',
                            },
                            '&.Mui-disabled': {
                                bgcolor: 'rgba(128, 128, 128, 0.05)',
                                color: 'rgba(128, 128, 128, 0.3)',
                            },
                        }}
                    >
                        <FolderOpenIcon className="w-5 h-5" />
                        <span>{t('folder.add-to-folder')}</span>
                    </Button>
                )}

                {/* 리마인더 섹션에서 알림 끄기 버튼 표시 */}
                {isInReminderSection && (
                    <Button
                        onClick={handleTurnOffAlarms}
                        disabled={selectedItems.size === 0}
                        sx={{
                            flex: 1,
                            height: 48,
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                            bgcolor: 'var(--selection-btn-bg)',
                            color: 'var(--selection-btn-text)',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            borderRadius: 2,
                            padding: '8px 16px',
                            '&:hover': {
                                filter: 'brightness(1.15)',
                            },
                            '&.Mui-disabled': {
                                bgcolor: 'rgba(128, 128, 128, 0.05)',
                                color: 'rgba(128, 128, 128, 0.3)',
                            },
                        }}
                    >
                        <BellSlashIcon className="w-5 h-5" />
                        <span>{t('alarm.turn-off')}</span>
                    </Button>
                )}

                <Button
                    onClick={handleDelete}
                    disabled={selectedItems.size === 0}
                    sx={{
                        flex: 1,
                        height: 48,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        bgcolor: 'rgba(128, 128, 128, 0.12)',
                        color: 'var(--inverted-text-color)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        borderRadius: 2,
                        padding: '8px 16px',
                        '&:hover': {
                            bgcolor: 'rgba(128, 128, 128, 0.2)',
                        },
                        '&.Mui-disabled': {
                            bgcolor: 'rgba(128, 128, 128, 0.05)',
                            color: 'rgba(128, 128, 128, 0.3)',
                        },
                    }}
                >
                    <TrashIcon className="w-5 h-5" />
                    <span>{t('read.delete')}</span>
                </Button>
            </div>
        </div>
    );
}
