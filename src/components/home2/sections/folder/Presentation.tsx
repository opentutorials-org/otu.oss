'use client';
import FolderGrid from '@/components/home/logined/DisplayType/FolderGrid';
import { enhancedRenderLogger } from '@/debug/render';
import { useTranslations } from 'next-intl';

type FolderData = {
    id: string;
    name: string;
    description?: string;
    page_count?: number;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    thumbnail_url?: string;
    last_page_added_at?: number;
};

type PresentationProps = {
    folders: FolderData[] | null;
    onSelect: (id: string) => void;
    onCreateFolder: () => void;
    error?: any;
};

export default function Presentation({
    folders,
    onSelect,
    onCreateFolder,
    error,
}: PresentationProps) {
    const t = useTranslations('content-list');

    enhancedRenderLogger('FolderPresentation rendered', {
        foldersLength: folders?.length || 0,
        error: !!error,
    });

    // 에러 상태
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <p className="mb-2">{t('error_occurred')}</p>
                <p className="text-sm text-gray-400">{error.message}</p>
            </div>
        );
    }

    return (
        <div>
            {/* 폴더 그리드 */}
            <div className="mt-4">
                <FolderGrid
                    folders={(folders || []).map((folder) => ({
                        ...folder,
                        page_count: folder.page_count || 0,
                        user_id: folder.user_id || '',
                        created_at: folder.created_at || new Date().toISOString(),
                        updated_at: folder.updated_at || new Date().toISOString(),
                        description: folder.description || '',
                        thumbnail_url: folder.thumbnail_url || '',
                        last_page_added_at: folder.last_page_added_at || Date.now(),
                    }))}
                    onSelect={onSelect}
                    onCreateFolder={onCreateFolder}
                    isCreatingFolder={false}
                />
            </div>

            {/* {folders && folders.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <p>{t('no_folders')}</p>
                    <button
                        onClick={onCreateFolder}
                        className="mt-2 text-sm text-blue-500 hover:text-blue-600"
                    >
                        {t('create_first_folder')}
                    </button>
                </div>
            )} */}

            <div className="h-5"></div>
        </div>
    );
}
