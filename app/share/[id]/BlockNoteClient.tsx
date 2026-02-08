'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteWrapper } from '@/components/common/BlockNoteEditor';
import { useLocale } from '@/hooks/useLocale';
import { ko, en } from '@blocknote/core/locales';
import DOMPurify from 'dompurify';

interface BlockNoteClientProps {
    body: string;
    onLog: (message: string, data?: any) => void;
}

export default function BlockNoteClient({ body, onLog }: BlockNoteClientProps) {
    const [editorReady, setEditorReady] = useState(false);
    const currentLocale = useLocale();

    // 현재 언어에 맞는 dictionary 선택
    const dictionary = useMemo(() => {
        return currentLocale === 'ko' ? ko : en;
    }, [currentLocale]);

    // 컴포넌트 최상위 레벨에서 훅 호출
    const editor = useCreateBlockNote({
        dictionary,
        domAttributes: {
            editor: {
                class: 'read-only-editor',
            },
        },
    });

    onLog('BlockNoteClient: BlockNote editor created');

    // HTML을 BlockNote에 로드
    useEffect(() => {
        onLog('BlockNoteClient: useEffect for HTML parsing triggered', {
            bodyLength: body?.length,
        });

        if (editor && body) {
            const initializeEditor = async () => {
                try {
                    onLog('BlockNoteClient: Starting HTML parsing');
                    const blocks = await editor.tryParseHTMLToBlocks(body);
                    onLog('BlockNoteClient: HTML parsed successfully', {
                        blocksCount: blocks.length,
                    });
                    editor.replaceBlocks(editor.document, blocks);
                    setEditorReady(true);
                    onLog('BlockNoteClient: Editor fully initialized');
                } catch (error) {
                    onLog('BlockNoteClient: HTML parsing error', error);
                    console.error('HTML 파싱 오류:', error);
                    setEditorReady(false);
                }
            };

            initializeEditor();
        }
    }, [editor, body, onLog]);

    // 에디터가 준비되지 않았다면 HTML을 직접 렌더링
    if (!editorReady && body) {
        return (
            <div
                className="rendered-html-content"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }}
            />
        );
    }

    // 에디터가 준비되었다면 BlockNoteWrapper 렌더링
    return (
        <BlockNoteWrapper
            editor={editor}
            darkMode={false}
            readOnly={true}
            pageId=""
            hideSideMenu={true}
            hasAI={false}
        />
    );
}
