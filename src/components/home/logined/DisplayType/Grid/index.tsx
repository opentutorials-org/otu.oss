import Masonry from 'react-masonry-css';
import Image from 'next/image';
import s from './style.module.css';
import {
    currentPageState,
    selectedItemsState,
    selectionModeState,
    toggleItemSelection,
} from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { getDisplayTitle } from '../../page/CreateUpdate/utils/textUtils';
import { CircleIcon } from '@/components/common/icons/CircleIcon';
import { FolderTag } from '@/components/common/FolderTag';
import { Add as AddIcon } from '@mui/icons-material';
import BellIcon from '@/public/icon/BellIcon';
import { getThumbnailUrl, isUploadcareUrl } from '@/functions/thumbnail';

type ContentListProps = {
    contents: {
        id: string;
        title: string;
        body: string;
        createdAt: string;
        img_url: string;
        length: number;
        type: string;
        folder_id?: string | null;
    }[];
    onSelect: (id: string, type: string) => void;
    hideFolderName?: boolean;
    onCreatePage?: () => void;
    isCreatingPage?: boolean;
    alarmStatuses?: Map<string, boolean>;
};

export default function List({
    contents,
    onSelect,
    hideFolderName = false,
    onCreatePage,
    isCreatingPage = false,
    alarmStatuses,
}: ContentListProps) {
    const [selectionMode, setSelectionMode] = useAtom(selectionModeState);
    const toggleSelection = useSetAtom(toggleItemSelection);
    const selectedItems = useAtomValue(selectedItemsState);
    const t = useTranslations();

    const breakpointColumnsObj = {
        default: 3,
        600: 2,
        350: 1,
    };

    const hasAlarm = (itemId: string) => alarmStatuses?.get(itemId) || false;

    // LCP 최적화: 이미지가 있는 첫 번째 아이템 찾기 (priority 적용을 위해)
    const firstImageItemId = useMemo(() => {
        const firstImageItem = contents.find(
            (item) => item.img_url && isUploadcareUrl(item.img_url)
        );
        return firstImageItem?.id;
    }, [contents]);

    return (
        <div>
            <Masonry
                breakpointCols={breakpointColumnsObj}
                className={s.my_masonry_grid}
                columnClassName={s.my_masonry_grid_column}
            >
                {/* 페이지 생성 카드 - 폴더 디테일 페이지에서만 표시 */}
                {onCreatePage && (
                    <div
                        className={`border-[1px] text-color rounded-[3px] cursor-pointer relative border-color list-bg-color touch-hover-guard hover:bg-[var(--focus-bg-color)] active:bg-[var(--focus-bg-color)] ${s.my_masonry_grid_column__div}`}
                        onClick={onCreatePage}
                    >
                        <div className="p-[20px] text-center flex flex-col items-center justify-center min-h-[120px]">
                            {isCreatingPage ? (
                                <div className="animate-spin text-2xl">⏳</div>
                            ) : (
                                <>
                                    <AddIcon
                                        sx={{ fontSize: 28, color: 'var(--text-color)', mb: 1 }}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* LCP 최적화: 이미지가 있는 첫 번째 아이템에만 priority 적용 */}
                {contents.map((item, index) => {
                    const displayTitle = getDisplayTitle(
                        item.title,
                        item.body,
                        1000,
                        t('common.no-title')
                    );

                    // 이미지가 있는 첫 번째 아이템에만 priority 적용
                    const hasImage = item.img_url && isUploadcareUrl(item.img_url);
                    const shouldPrioritize = !!(hasImage && firstImageItemId === item.id);

                    return (
                        <div
                            key={item.id}
                            className={`border-[1px] text-color rounded-[3px] cursor-pointer relative border-color list-bg-color  touch-hover-guard hover:bg-[var(--focus-bg-color)] active:bg-[var(--focus-bg-color)] ${s.my_masonry_grid_column__div}`}
                            data-selected={selectedItems.has(item.id) || undefined}
                            style={{
                                contain: 'layout style', // 레이아웃 및 스타일 격리로 CLS 방지
                                backgroundColor: selectedItems.has(item.id)
                                    ? 'var(--selection-color)'
                                    : undefined,
                                transition: 'background-color 0.15s ease-out',
                            }}
                            onClick={() => {
                                if (selectionMode) {
                                    toggleSelection(item.id);
                                } else {
                                    onSelect(item.id, item.type);
                                }
                            }}
                        >
                            {hasImage && (
                                <div
                                    className={s.image_wrapper}
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                        aspectRatio: '1 / 1', // CSS aspect-ratio로 CLS 방지
                                        overflow: 'hidden',
                                        contain: 'layout', // 레이아웃 격리로 CLS 방지
                                        minHeight: '200px', // 최소 높이 명시로 초기 공간 확보
                                        backgroundColor: 'var(--list-bg-color)', // 이미지 로드 전 배경색으로 공간 확보
                                    }}
                                >
                                    <Image
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        alt={item.title}
                                        className={`rounded-t-[2px] ${s.image_overlay}`}
                                        src={getThumbnailUrl(item.img_url) || ''}
                                        style={{
                                            objectFit: 'cover', // 이미지를 컨테이너에 맞게 잘라서 표시
                                        }}
                                        priority={shouldPrioritize}
                                        fetchPriority={shouldPrioritize ? 'high' : 'auto'}
                                        loading={shouldPrioritize ? 'eager' : 'lazy'}
                                        unoptimized // Uploadcare 최적화 유지
                                        onError={(e) => {
                                            // 렌더링을 차단하지 않는 인라인 에러 핸들링
                                            const target = e.currentTarget as HTMLImageElement;
                                            target.alt = t('images-are-only-visible-online');
                                        }}
                                    />
                                    {/* 선택 시 이미지 오버레이 */}
                                    {selectedItems.has(item.id) && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                backgroundColor: 'var(--selection-overlay-color)',
                                                borderRadius: '2px 2px 0 0',
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                            <div
                                className={`text-sm p-[10px] break-words ${s.title} ${!item.title || item.title.trim() === '' ? 'text-gray-500 italic' : ''}`}
                            >
                                <div className="flex items-start gap-1">
                                    <div
                                        className="break-all overflow-wrap-anywhere leading-normal"
                                        style={{
                                            wordBreak: 'break-all',
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {selectionMode ? (
                                            selectedItems.has(item.id) ? (
                                                <CheckCircleIcon
                                                    className="w-4 h-4 mt-[3px] mr-[2px] float-left"
                                                    style={{ color: 'var(--text-color)' }}
                                                />
                                            ) : (
                                                <CircleIcon
                                                    className="w-4 h-4 mt-[3px] mr-[2px] float-left"
                                                    style={{ color: 'var(--text-color)' }}
                                                />
                                            )
                                        ) : null}
                                        {hasAlarm(item.id) && (
                                            <div className="float-left focus-bg-color p-[2px] mr-[3px] rounded-full mt-[3px]">
                                                <BellIcon
                                                    width="11"
                                                    height="11"
                                                    className="text-color"
                                                />
                                            </div>
                                        )}
                                        <FolderTag
                                            folderId={item.folder_id}
                                            hideFolderName={hideFolderName}
                                        />
                                        {displayTitle}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </Masonry>
        </div>
    );
}
