import { BlockNoteEditor } from '@blocknote/core';
import { DefaultReactSuggestionItem, getDefaultReactSlashMenuItems } from '@blocknote/react';
import { uploadcareItem } from './uploadcareIntegration';

// List containing all default Slash Menu Items, as well as our custom one.
export const getCustomSlashMenuItems = (
    editor: BlockNoteEditor,
    t: (key: string) => string,
    pageId: string
): DefaultReactSuggestionItem[] => {
    const defaultItems = getDefaultReactSlashMenuItems(editor);

    const mediaGroupTitle = t('slash-menu.group.media');
    const mediaSlashMenuTitle = t('slash-menu.media');
    const mediaDescription = t('slash-menu.media-description');

    // Media 그룹의 시작 인덱스 찾기
    const mediaGroupStartIndex = defaultItems.findIndex((item) => item.group === mediaGroupTitle);

    // Find the image item to use its icon
    const imageItem = defaultItems.find((item) => (item as any).key === 'image');

    // Create our custom uploadcare item with the image icon
    const uploadcareMenuItem = uploadcareItem(
        editor,
        mediaGroupTitle,
        mediaSlashMenuTitle,
        mediaDescription,
        pageId
    );

    // Set the icon from the image item
    uploadcareMenuItem.icon = imageItem?.icon;

    // Image, Video, Quote 메뉴 제거하고 나머지 항목들 필터링
    const filteredItems = defaultItems.filter(
        (item) =>
            (item as any).key !== 'image' &&
            (item as any).key !== 'video' &&
            (item as any).key !== 'audio' &&
            (item as any).key !== 'file' &&
            (item as any).key !== 'quote' &&
            (item as any).key !== 'toggle_list' &&
            (item as any).key !== 'toggle_heading' &&
            (item as any).key !== 'toggle_heading_2' &&
            (item as any).key !== 'toggle_heading_3' &&
            (item as any).key !== 'toggle_heading_4' &&
            (item as any).key !== 'toggle_heading_5' &&
            (item as any).key !== 'toggle_heading_6' &&
            (item as any).key !== 'heading_4' &&
            (item as any).key !== 'heading_5' &&
            (item as any).key !== 'heading_6'
    );

    if (mediaGroupStartIndex !== -1) {
        // Media 그룹이 있으면 그 위치에 Uploadcare 삽입
        return [
            ...filteredItems.slice(0, mediaGroupStartIndex),
            uploadcareMenuItem,
            ...filteredItems.slice(mediaGroupStartIndex),
        ];
    } else {
        // Media 그룹이 없으면 마지막에 추가
        return [...filteredItems, uploadcareMenuItem];
    }
};

export const filterSlashMenuItems = async (items: DefaultReactSuggestionItem[], query: string) => {
    return items.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
};
