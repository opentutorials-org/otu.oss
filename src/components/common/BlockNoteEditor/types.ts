import { BlockNoteEditor as BlockNoteEditorType } from '@blocknote/core';
import { DefaultReactSuggestionItem } from '@blocknote/react';

export interface UploadcareFile {
    uuid: string;
    cdnUrl: string;
    name: string;
    isImage: boolean;
    mimeType?: string;
    contentInfo?: {
        image?: {
            width: number;
            height: number;
        };
    };
}

export interface UploadcareEvent extends Event {
    detail: UploadcareFile;
}

export interface BlockNoteProps {
    editor: BlockNoteEditorType;
    darkMode: boolean;
    pageId: string;
    readOnly?: boolean;
    hideSideMenu?: boolean;
    hasAI?: boolean;
}
