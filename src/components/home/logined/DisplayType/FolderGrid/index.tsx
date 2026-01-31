'use client';

import React, { useEffect, useState } from 'react';
import Masonry from 'react-masonry-css';
import Image from 'next/image';
import AddIcon from '@mui/icons-material/Add';
import { selectedItemsState, selectionModeState, toggleItemSelection } from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { CheckCircleIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { getPagesByFolderId, update as updateFolder } from '@/watermelondb/control/Folder';
import { folderLogger } from '@/debug/folder';
import s from '../Grid/style.module.css';
import { useTranslations } from 'next-intl';
import { CircleIcon } from '@/components/common/icons/CircleIcon';
import { getThumbnailUrl, isUploadcareUrl } from '@/functions/thumbnail';

type Folder = {
    id: string;
    name: string;
    description?: string;
    thumbnail_url?: string;
    page_count: number;
    created_at: string;
    updated_at: string;
    user_id: string;
};

type FolderGridProps = {
    folders: Folder[];
    onSelect: (id: string, type: string) => void;
    onCreateFolder?: () => void;
    isCreatingFolder?: boolean;
};

export default function FolderGrid({
    folders,
    onSelect,
    onCreateFolder,
    isCreatingFolder = false,
}: FolderGridProps) {
    const [selectionMode] = useAtom(selectionModeState);
    const toggleSelection = useSetAtom(toggleItemSelection);
    const selectedItems = useAtomValue(selectedItemsState);
    const [foldersWithThumbnails, setFoldersWithThumbnails] = useState<Folder[]>(folders);
    const t = useTranslations('folder');

    // 폴더 썸네일 자동 업데이트
    useEffect(
        function updateFolderThumbnails() {
            // folders prop이 변경되면 즉시 동기화 (삭제 등으로 빈 배열이 될 수 있음)
            if (!folders || folders.length === 0) {
                setFoldersWithThumbnails([]);
                return;
            }

            const updateThumbnails = async () => {
                folderLogger('폴더 썸네일 자동 업데이트 시작', { folderCount: folders.length });

                try {
                    const updatedFolders = await Promise.all(
                        folders.map(async (folder) => {
                            try {
                                // 이미 썸네일이 있으면 건너뛰기
                                if (folder.thumbnail_url) {
                                    return folder;
                                }

                                // 폴더의 페이지들 조회
                                const pages = await getPagesByFolderId(folder.id);

                                // img_url이 있는 첫 번째 페이지 찾기
                                const pageWithImage = pages.find(
                                    (page) =>
                                        // @ts-ignore
                                        page.img_url && page.img_url.trim() !== ''
                                );

                                if (pageWithImage) {
                                    // @ts-ignore
                                    const thumbnailUrl = pageWithImage.img_url;

                                    // 폴더의 thumbnail_url 업데이트
                                    await updateFolder({
                                        id: folder.id,
                                        thumbnail_url: thumbnailUrl,
                                        updated_at: new Date().toISOString(),
                                    });

                                    folderLogger('폴더 썸네일 업데이트 완료', {
                                        folderId: folder.id,
                                        folderName: folder.name,
                                        thumbnailUrl,
                                    });

                                    return {
                                        ...folder,
                                        thumbnail_url: thumbnailUrl,
                                    };
                                }

                                return folder;
                            } catch (error) {
                                folderLogger('폴더 썸네일 업데이트 실패', {
                                    folderId: folder.id,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                                return folder;
                            }
                        })
                    );

                    setFoldersWithThumbnails(updatedFolders);
                    folderLogger('폴더 썸네일 자동 업데이트 완료', {
                        updatedCount: updatedFolders.length,
                    });
                } catch (error) {
                    folderLogger('폴더 썸네일 자동 업데이트 에러', {
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            };

            updateThumbnails();
        },
        [folders]
    );

    const breakpointColumnsObj = {
        default: 3,
        600: 2,
        350: 1,
    };

    return (
        <div>
            <Masonry
                breakpointCols={breakpointColumnsObj}
                className={s.my_masonry_grid}
                columnClassName={s.my_masonry_grid_column}
            >
                {/* 새 폴더 생성 카드 */}
                {onCreateFolder && (
                    <div
                        className={`border-[1px] text-color rounded-[3px] cursor-pointer relative border-color list-bg-color touch-hover-guard hover:bg-[var(--focus-bg-color)] active:bg-[var(--focus-bg-color)] ${s.my_masonry_grid_column__div}`}
                        onClick={onCreateFolder}
                        style={{
                            aspectRatio: '1 / 1', // 정사각형 비율 강제
                            position: 'relative',
                        }}
                    >
                        {/* 컨테이너를 정사각형으로 만들고 내부에 아이콘만 중앙 배치 */}
                        <div
                            style={{
                                position: 'relative',
                                width: '100%',
                                height: '100%',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {/* 추가 아이콘과 레이블 - 수직 중앙 정렬 */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                }}
                            >
                                <AddIcon sx={{ fontSize: 32, color: 'var(--text-color)' }} />
                                <span
                                    style={{
                                        fontSize: '14px',
                                        color: 'var(--text-color)',
                                        fontWeight: '500',
                                    }}
                                >
                                    {t('new-folder')}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* LCP 최적화: 썸네일이 있는 첫 번째 폴더만 priority 적용 */}
                {(() => {
                    let firstThumbnailFound = false;
                    return foldersWithThumbnails.map((folder, index) => {
                        const selectionIcon = selectionMode ? (
                            <div className="float-left m-[3px] ml-0">
                                {selectedItems.has(folder.id) ? (
                                    <CheckCircleIcon
                                        className="w-4 h-4"
                                        style={{ color: 'var(--text-color)' }}
                                    />
                                ) : (
                                    <CircleIcon
                                        className="w-4 h-4"
                                        style={{ color: 'var(--text-color)' }}
                                    />
                                )}
                            </div>
                        ) : null;

                        // 썸네일이 있는 첫 번째 폴더에만 priority 적용
                        const hasThumbnail =
                            folder.thumbnail_url && isUploadcareUrl(folder.thumbnail_url);
                        const shouldPrioritize = !!(hasThumbnail && !firstThumbnailFound);
                        if (hasThumbnail && !firstThumbnailFound) firstThumbnailFound = true;

                        return (
                            <div
                                key={folder.id}
                                className={`border-[1px] text-color rounded-[3px] cursor-pointer relative border-color list-bg-color touch-hover-guard hover:bg-[var(--focus-bg-color)] active:bg-[var(--focus-bg-color)] ${s.my_masonry_grid_column__div}`}
                                data-selected={selectedItems.has(folder.id) || undefined}
                                onClick={() => {
                                    if (selectionMode) {
                                        toggleSelection(folder.id);
                                    } else {
                                        onSelect(folder.id, 'folder');
                                    }
                                }}
                                style={{
                                    aspectRatio: '1 / 1', // 정사각형 비율 강제
                                    position: 'relative',
                                    backgroundColor: selectedItems.has(folder.id)
                                        ? 'var(--selection-color)'
                                        : undefined,
                                    transition: 'background-color 0.15s ease-out',
                                }}
                            >
                                {/* 컨테이너를 정사각형으로 만들고 내부에 이미지/아이콘과 제목을 배치 */}
                                <div
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: '100%',
                                        overflow: 'hidden',
                                        contain: 'layout', // 레이아웃 격리로 CLS 방지
                                    }}
                                >
                                    {hasThumbnail ? (
                                        <>
                                            <Image
                                                fill
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                alt={folder.name}
                                                className={`rounded-t-[2px] ${s.image_overlay}`}
                                                src={
                                                    getThumbnailUrl(folder.thumbnail_url || '') ||
                                                    ''
                                                }
                                                style={{
                                                    objectFit: 'cover',
                                                }}
                                                priority={shouldPrioritize}
                                                fetchPriority={shouldPrioritize ? 'high' : 'auto'}
                                                loading={shouldPrioritize ? 'eager' : 'lazy'}
                                                unoptimized // Uploadcare 최적화 유지
                                            />
                                            {/* 선택 시 이미지 오버레이 */}
                                            {selectedItems.has(folder.id) && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        backgroundColor:
                                                            'var(--selection-overlay-color)',
                                                        borderRadius: '2px',
                                                        pointerEvents: 'none',
                                                    }}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        // 썸네일이 없는 경우 아이콘만 표시 (배경색 제거)
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '35%',
                                                left: '40%',
                                                scale: 0.8,
                                                color: 'var(--text-secondary-color)',
                                                opacity: 0.6,
                                            }}
                                        >
                                            <FolderOpenIcon className="w-8 h-8" />
                                        </div>
                                    )}

                                    {/* 폴더 정보 - 하단에 오버레이로 배치, 배경색 적용 */}
                                    <div
                                        className={`absolute bottom-0 left-0 right-0 p-[10px] break-words ${s.title}`}
                                        style={{
                                            backgroundColor: 'var(--focus-bg-color)',
                                            borderBottomLeftRadius: '2px',
                                            borderBottomRightRadius: '2px',
                                        }}
                                    >
                                        <div
                                            className="font-semibold text-sm"
                                            style={{
                                                color: 'var(--text-color)',
                                            }}
                                        >
                                            {selectionIcon}
                                            {folder.name}{' '}
                                            {t('page-count-short', { count: folder.page_count })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    });
                })()}
            </Masonry>
        </div>
    );
}
