import { BlockNoteEditor } from '@blocknote/core';
import { DefaultReactSuggestionItem } from '@blocknote/react';

// Custom Slash Menu item to insert a block after the current one.
export const uploadcareItem = (
    editor: BlockNoteEditor,
    mediaGroupTitle: string,
    mediaSlashMenuTitle: string,
    mediaDescription: string,
    pageId: string
): DefaultReactSuggestionItem => {
    return {
        title: mediaSlashMenuTitle,
        onItemClick: () => {
            // 글로벌 이벤트를 통해 에디터 업로더 열기
            window.dispatchEvent(
                new CustomEvent('openEditorUploader', {
                    detail: {
                        editor,
                        mode: 'editor_insert',
                    },
                })
            );
        },
        aliases: ['upload', 'media', 'file', 'image', 'video', 'pdf'],
        group: mediaGroupTitle,
        icon: undefined, // This will be set in the slashMenu.ts file
        subtext: mediaDescription,
    };
};
