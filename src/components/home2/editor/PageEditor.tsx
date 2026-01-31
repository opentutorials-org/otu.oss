'use client';
import { useMemo, useEffect, useCallback, useRef, useState } from 'react';
import { Control } from '@/components/common/scene/Control';
import { Screen } from '@/components/common/scene/Screen';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { EditorLoadingErrorFallback } from '@/components/common/BlockNoteEditor/EditorLoadingErrorFallback';
import { HeaderArea } from '@/components/home/logined/page/CreateUpdate/components/HeaderArea';
import { EditorControls } from './components/EditorControls';
import { usePageData } from './hooks/usePageData';
import { usePageSave } from './hooks/usePageSave';
import { useEditorState } from './hooks/useEditorState';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { runEmbedding } from '@/functions/ai/runEmbedding';
import { editorStateType } from '@/types';
import RelatedPosts from '@/components/home/logined/page/CreateUpdate/RelatedPosts';

// Dynamically import EditorContainer to isolate BlockNote dependencies
const EditorContainer = dynamic(() => import('./EditorContainer'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-96">
            <Image
                src="/icon/redactor-ai-loading.svg"
                height={39}
                width={39}
                alt="loading"
                className="otu_loading mx-auto"
            />
        </div>
    ),
});

interface PageEditorProps {
    pageId: string;
    folderId?: string | null;
    navigate?: (path: string) => void;
    onContentChange?: (content: any, isModified: boolean) => void;
}

/**
 * 통합 페이지 에디터 컴포넌트 (Lightweight Shell)
 * BlockNote 의존성을 EditorContainer로 분리하여 번들 크기 최적화
 */
export default function PageEditor({
    pageId,
    folderId,
    navigate,
    onContentChange,
}: PageEditorProps) {
    // 에디터 인스턴스를 상태로 관리
    const [editor, setEditor] = useState<any>(null);

    // 1. 페이지 데이터 로드
    const { content, mode, setMode, isLoading } = usePageData(pageId);

    // 2. 저장/삭제 핸들러
    const { submit, handleDelete } = usePageSave(content, folderId, navigate, mode, setMode);

    // 3. 에디터 상태 관리 (에디터 인스턴스 전달)
    const {
        title,
        setTitle,
        body,
        submitHandler,
        isModified,
        setIsModified,
        bodyLength,
        isAutoSaving,
        lastAutoSaveTime,
        triggerAutoSave,
        isInitialized,
        editorHtmlParseError,
        fallbackHtml,
    } = useEditorState(content, mode, editor, submit);

    // 4. 키보드 단축키
    const { saveShortcutText } = useKeyboardShortcuts({
        isOpen: true,
        submitHandler,
        setIsModified,
    });

    // submitHandler와 isModified를 ref로 관리하여 cleanup에서 최신 값 사용
    const submitHandlerRef = useRef(submitHandler);
    const isModifiedRef = useRef(isModified);

    useEffect(() => {
        submitHandlerRef.current = submitHandler;
    }, [submitHandler]);

    useEffect(() => {
        isModifiedRef.current = isModified;
    }, [isModified]);

    // 컴포넌트 언마운트 시 저장 및 임베딩 실행
    useEffect(() => {
        return () => {
            // ref에서 최신 값 가져오기
            if (isModifiedRef.current) {
                submitHandlerRef.current();
                // sync 대기를 위한 임베딩 지연
                setTimeout(() => {
                    runEmbedding();
                }, 4000);
            }
        };
    }, []); // 빈 배열 - 언마운트 시에만 실행

    // content 변경 감지 및 부모 컴포넌트에 전달
    useEffect(() => {
        if (onContentChange && content) {
            onContentChange(content, isModified);
        }
    }, [content, isModified, onContentChange]);

    // openInfo 구성 (기존 인터페이스 호환성 유지)
    const openInfo: editorStateType = useMemo(
        () => ({
            id: pageId,
            open: true,
            type: 'page',
            mode,
        }),
        [pageId, mode]
    );

    // 제목 변경 핸들러
    const handleTitleChange = useCallback(
        (newTitle: string) => {
            setTitle(newTitle);
            setIsModified(true);
            if (triggerAutoSave) {
                triggerAutoSave();
            }
        },
        [setTitle, setIsModified, triggerAutoSave]
    );

    // 에디터 준비 콜백
    const handleEditorReady = useCallback((editorInstance: any) => {
        setEditor(editorInstance);
    }, []);

    // mode가 null이면 데이터 로딩 중
    if (mode === null || isLoading) {
        return null;
    }

    return (
        <Screen open={true}>
            <div>
                {/* 헤더 영역 */}
                <HeaderArea
                    content={content}
                    onDelete={handleDelete}
                    openInfo={openInfo}
                    title={title}
                    onTitleChange={handleTitleChange}
                    onChangeIsModified={setIsModified}
                    triggerAutoSave={triggerAutoSave}
                    editor={editor}
                    onTitleSync={setTitle}
                />

                {/* 에디터 영역 */}
                {editorHtmlParseError && fallbackHtml ? (
                    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
                        <EditorLoadingErrorFallback html={fallbackHtml} />
                    </div>
                ) : (
                    <EditorContainer
                        pageId={pageId}
                        mode={mode}
                        onEditorReady={handleEditorReady}
                    />
                )}
                {/* 관련 글 (update 모드일 때만) */}
                {content?.id && mode === 'update' && (
                    <div className="mt-5">
                        <RelatedPosts currentPageId={content.id} sperator={false} />
                    </div>
                )}

                <div style={{ height: 'env(keyboard-inset-height, 0px)' }}></div>
            </div>

            {/* 하단 컨트롤 버튼 */}
            <Control>
                <EditorControls
                    onSubmit={submitHandler}
                    saveShortcutText={saveShortcutText}
                    isModified={isModified}
                    isAutoSaving={isAutoSaving}
                    bodyLength={bodyLength}
                    title={title}
                />
            </Control>
        </Screen>
    );
}
