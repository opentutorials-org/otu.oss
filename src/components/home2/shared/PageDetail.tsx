'use client';

import { useParams } from 'react-router-dom';
import { useNavigation } from '@/hooks/useNavigation';
import { useMemo, useCallback, memo, useState } from 'react';
import { useAtom } from 'jotai';
import { isModifiedState } from '@/lib/jotai';
import SwipeableModal from './SwipeableModal';
import { Z_INDEX } from '@/constants';
import PageEditor from '@/components/home2/editor/PageEditor';
import { ulid } from 'ulid';
import { content } from '@/types';

function PageDetail() {
    const { pageId, folderId } = useParams();
    const { navigate } = useNavigation();
    const currentPageId = useMemo(() => pageId || ulid(), [pageId]);

    const [isModified] = useAtom(isModifiedState);
    const [currentContent, setCurrentContent] = useState<content | null>(null);

    const handleContentChange = useCallback((content: content | null, modified: boolean) => {
        setCurrentContent(content);
    }, []);

    const handleClose = useCallback(() => {
        navigate('..');
    }, [navigate]);

    return (
        <SwipeableModal zIndex={Z_INDEX.PAGE_DETAIL_MODAL} onClose={handleClose}>
            <PageEditor
                pageId={currentPageId}
                folderId={folderId}
                navigate={navigate}
                onContentChange={handleContentChange}
            />
        </SwipeableModal>
    );
}

export default memo(PageDetail);
