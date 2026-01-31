'use client';
import { useMemo, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { isDarkModeAtom } from '@/lib/jotai';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { ko, en } from '@blocknote/core/locales';
import { useLocale, useTranslations } from 'next-intl';
import { useCreateBlockNote } from '@/components/common/BlockNoteEditor';
import { BlockNoteWrapper } from '@/components/common/BlockNoteEditor';
import { editorIndexLogger } from '@/debug/editor';

interface EditorContainerProps {
    pageId: string;
    mode: 'create' | 'update' | null;
    onEditorReady: (editor: any) => void;
}

/**
 * EditorContainer - Heavy component with all BlockNote dependencies
 * This component is dynamically loaded to isolate the ~824KB BlockNote bundle
 */
export default function EditorContainer({ pageId, mode, onEditorReady }: EditorContainerProps) {
    const darkMode = useAtomValue(isDarkModeAtom);
    const currentLocale = useLocale();
    const tEditor = useTranslations('editor');

    // locale 변경 시에만 dictionary와 schema를 재생성하여 오버헤드 최소화
    const { dictionary, schema } = useMemo(() => {
        const dict = currentLocale === 'ko' ? ko : en;
        const sch = BlockNoteSchema.create({
            blockSpecs: {
                ...defaultBlockSpecs,
            },
        });
        return { dictionary: dict, schema: sch };
    }, [currentLocale]);

    // BlockNote 에디터 생성
    const editor = useCreateBlockNote({
        dictionary,
        schema,
    });

    // 에디터가 준비되면 부모에게 전달
    useEffect(
        function notifyEditorReady() {
            if (editor) {
                onEditorReady(editor);
            }
        },
        [editor, onEditorReady]
    );

    // pageId가 바뀌는 경우에만 리마운트
    // mode(create/update) 변화는 tiptap view 언마운트를 야기하므로 key에 포함하지 않는다
    const editorKey = useMemo(() => pageId, [pageId]);

    useEffect(
        function logEditorKeyStrategy() {
            editorIndexLogger('EditorContainer key computed', {
                pageId,
                mode,
                editorKey,
            });
        },
        [editorKey, mode, pageId]
    );

    if (!editor) {
        return <div className="p-4 text-center">{tEditor('loading') || 'Loading...'}</div>;
    }

    return (
        <div className="pb-[100px]">
            <BlockNoteWrapper
                key={editorKey}
                // @ts-ignore
                editor={editor}
                darkMode={darkMode}
                pageId={pageId}
                hasAI={false}
            />
        </div>
    );
}
