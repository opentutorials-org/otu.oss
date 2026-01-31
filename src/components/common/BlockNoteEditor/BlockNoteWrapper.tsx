'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import {
    SuggestionMenuController,
    DefaultReactSuggestionItem,
    SuggestionMenuProps,
    FormattingToolbarController,
    FormattingToolbar,
    getFormattingToolbarItems,
    useCreateBlockNote,
    blockTypeSelectItems,
    useDictionary,
} from '@blocknote/react';
import { AIMenuController, AIToolbarButton, getAISlashMenuItems } from '@blocknote/xl-ai';
import { BlockNoteProps } from './types';
import { getCustomSlashMenuItems, filterSlashMenuItems } from './slashMenu';
import { customTheme } from './styles';
import styles from './styles.module.css';
// BlockNote CSS는 이 컴포넌트가 사용될 때만 로드되도록 유지
// (BlockNoteWrapper가 dynamic import로 사용되므로 CSS도 함께 코드 스플리팅됨)
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import '@/app/blocknote.css';
import { useSetAtom } from 'jotai';
import { openSnackbarState, editorUploaderContextState } from '@/lib/jotai';
import { useImageDrop } from './hooks/useImageDrop';
import { useTranslations } from 'next-intl';
import { en as aiEn } from '@blocknote/xl-ai/locales';
import { en } from '@blocknote/core/locales';
import { blocknoteLogger } from '@/debug/blocknote';

// AI 기능이 활성화되어 있는지 확인하는 함수
function checkAIEnabled(editor: any): boolean {
    try {
        // AI extension이 있는지 확인하는 여러 방법을 시도

        // 1. AI 슬래시 메뉴 아이템이 있는지 확인
        const aiSlashItems = getAISlashMenuItems(editor);
        if (aiSlashItems && aiSlashItems.length > 0) {
            return true;
        }

        // 2. Tiptap 에디터의 extension 목록에서 AI extension 확인
        const extensions = editor._tiptapEditor?.extensionManager?.extensions || [];
        const hasAIExtension = extensions.some(
            (ext: any) => ext.name?.toLowerCase().includes('ai') || ext.name?.includes('AI')
        );

        if (hasAIExtension) {
            return true;
        }

        // 3. AI 관련 명령어가 있는지 확인
        const commands = editor._tiptapEditor?.commands || {};
        const hasAICommands = Object.keys(commands).some((command) =>
            command.toLowerCase().includes('ai')
        );

        return hasAICommands;
    } catch (error) {
        console.warn('AI 기능 체크 중 오류:', error);
        return false;
    }
}

// 커스텀 슬래시 메뉴 컴포넌트
function CustomSlashMenu(props: SuggestionMenuProps<DefaultReactSuggestionItem>) {
    return (
        <div className={styles.customSlashMenu}>
            <div className={styles.slashMenuGrid}>
                {props.items.map((item, index) => (
                    <div
                        key={index}
                        className={`${styles.slashMenuItem} click-animation`}
                        onClick={() => {
                            props.onItemClick?.(item);
                        }}
                    >
                        <div className={styles.slashMenuItemIcon}>
                            {typeof item.icon === 'string' ? (
                                <span className={styles.slashMenuItemIconText}>{item.icon}</span>
                            ) : (
                                item.icon
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// AI가 활성화된 경우에만 사용하는 Formatting toolbar
function FormattingToolbarWithAI({ hasAI }: { hasAI: boolean }) {
    const dict = useDictionary();

    // 기본 blockTypeSelectItems를 가져와서 필터링
    const customBlockTypeItems = useMemo(() => {
        const allItems = blockTypeSelectItems(dict);

        // 토글 헤딩(1~3)과 일반 헤딩(4~6)을 제외
        return allItems.filter((item) => {
            // 토글 헤딩 제거: isToggleable 속성이 있는 항목
            if (item.props && 'isToggleable' in item.props && item.props.isToggleable) {
                return false;
            }

            // 헤딩 4, 5, 6 제거
            if (item.type === 'heading' && item.props && 'level' in item.props) {
                const level = item.props.level as number;
                if (level >= 4) {
                    return false;
                }
            }

            return true;
        });
    }, [dict]);

    return (
        <FormattingToolbarController
            formattingToolbar={() => (
                <FormattingToolbar>
                    {...getFormattingToolbarItems(customBlockTypeItems)}
                    {/* AI 버튼은 AI가 활성화된 경우에만 추가 */}
                    {hasAI && <AIToolbarButton />}
                </FormattingToolbar>
            )}
        />
    );
}

export const BlockNoteWrapper: React.FC<BlockNoteProps> = ({
    editor,
    darkMode,
    pageId,
    readOnly,
    hideSideMenu = false,
    hasAI,
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isUnmountingRef = useRef(false);
    const openSnackbar = useSetAtom(openSnackbarState);
    const setEditorContext = useSetAtom(editorUploaderContextState);
    const tEditor = useTranslations('editor');
    const { isUploading, handleDrop, handlePaste } = useImageDrop({ editor, pageId, t: tEditor });

    // AI 기능 활성화 여부를 메모이제이션하여 성능 최적화
    const isAIEnabled = useMemo(() => {
        // hasAI prop이 명시적으로 전달된 경우 해당 값 사용
        if (hasAI !== undefined) {
            return hasAI;
        }
        // 그렇지 않으면 에디터에서 AI 기능이 활성화되어 있는지 자동 감지
        return checkAIEnabled(editor);
    }, [editor, hasAI]);

    // updateBlock 메서드를 안전하게 래핑하여 블록이 존재하지 않을 때의 오류를 처리
    useEffect(() => {
        if (!editor) return;

        // 원본 updateBlock 메서드 저장
        const originalUpdateBlock = editor.updateBlock.bind(editor);

        // updateBlock 메서드를 안전한 버전으로 대체
        (editor as any).updateBlock = function (
            blockToUpdate: any,
            update: any,
            ...restArgs: any[]
        ) {
            try {
                const blockId =
                    typeof blockToUpdate === 'string' ? blockToUpdate : blockToUpdate?.id;

                // 현재 문서의 모든 블록 정보 수집
                const currentBlocks = editor.document;
                const currentBlocksInfo = currentBlocks.map((block) => ({
                    id: block.id,
                    type: block.type,
                    props: block.props,
                    hasUrl: !!(block.props as any)?.url,
                    hasPreviewWidth: (block.props as any)?.previewWidth !== undefined,
                }));

                blocknoteLogger('updateBlock called', {
                    targetBlockId: blockId,
                    updateProps: update?.props,
                    timestamp: Date.now(),
                    currentBlocksInfo,
                    totalBlocksCount: currentBlocks.length,
                });

                // 블록이 현재 문서에 존재하는지 확인
                let targetBlock = null;

                if (typeof blockToUpdate === 'string') {
                    targetBlock = currentBlocks.find((block) => block.id === blockToUpdate);
                } else {
                    targetBlock = currentBlocks.find((block) => block.id === blockToUpdate?.id);
                }

                if (!targetBlock) {
                    const imageBlocks = currentBlocks.filter((block) => block.type === 'image');

                    blocknoteLogger('Block not found - analyzing situation', {
                        requestedBlockId: blockId,
                        requestedUpdate: update,
                        availableBlocks: currentBlocksInfo,
                        imageBlocks: imageBlocks.map((block) => ({
                            id: block.id,
                            type: block.type,
                            hasUrl: !!(block.props as any)?.url,
                            hasPreviewWidth: (block.props as any)?.previewWidth !== undefined,
                            url: ((block.props as any)?.url?.substring(0, 50) || 'no-url') + '...', // URL 일부만 표시
                        })),
                        isImageResizeUpdate: update?.props?.previewWidth !== undefined,
                    });

                    // 같은 타입의 블록을 찾아보기 (이미지 블록인 경우)
                    if (update?.props?.previewWidth !== undefined) {
                        const candidateImageBlocks = currentBlocks.filter(
                            (block) =>
                                block.type === 'image' &&
                                (block.props as any)?.url &&
                                !(block.props as any)?.previewWidth
                        );

                        if (candidateImageBlocks.length > 0) {
                            // 가장 최근에 추가된 이미지 블록을 대상으로 설정
                            targetBlock = candidateImageBlocks[candidateImageBlocks.length - 1];

                            blocknoteLogger('Found alternative image block for resize', {
                                originalRequestedBlockId: blockId,
                                selectedAlternativeBlock: {
                                    id: targetBlock.id,
                                    type: targetBlock.type,
                                    props: targetBlock.props,
                                    url:
                                        ((targetBlock.props as any)?.url?.substring(0, 50) ||
                                            'no-url') + '...',
                                },
                                candidateBlocks: candidateImageBlocks.map((block) => ({
                                    id: block.id,
                                    url:
                                        ((block.props as any)?.url?.substring(0, 30) || 'no-url') +
                                        '...',
                                })),
                                updateToApply: update?.props,
                                reason: 'Selected last image block without previewWidth for resize operation',
                            });
                        }
                    }

                    // 대안 블록도 없으면 업데이트 스킵
                    if (!targetBlock) {
                        blocknoteLogger('No alternative block found - skipping update', {
                            requestedBlockId: blockId,
                            updateType:
                                update?.props?.previewWidth !== undefined
                                    ? 'image-resize'
                                    : 'other',
                            availableImageBlocks: imageBlocks.length,
                            reason: 'No suitable alternative block available',
                        });
                        return;
                    }
                } else {
                    blocknoteLogger('Target block found - proceeding with original block', {
                        targetBlock: {
                            id: targetBlock.id,
                            type: targetBlock.type,
                            props: targetBlock.props,
                        },
                        updateToApply: update?.props,
                    });
                }

                // 유효한 블록으로 원본 메서드 호출
                return originalUpdateBlock.apply(this, [targetBlock, update, ...restArgs] as any);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : undefined;

                blocknoteLogger('updateBlock error caught and handled', {
                    blockToUpdate:
                        typeof blockToUpdate === 'string'
                            ? blockToUpdate
                            : blockToUpdate?.id || 'unknown',
                    error: errorMessage,
                    stack: errorStack,
                    currentDocumentBlocks:
                        editor.document?.map((b) => ({ id: b.id, type: b.type })) || [],
                });

                // 블록을 찾을 수 없다는 오류가 발생했을 때만 조용히 처리
                if (errorMessage.includes('Block with ID') && errorMessage.includes('not found')) {
                    console.warn(
                        'BlockNote updateBlock - Block not found error handled silently:',
                        errorMessage
                    );
                    return;
                }

                // 다른 오류는 다시 던짐
                throw error;
            }
        };

        // 클리너 함수에서 원본 메서드 복원
        return () => {
            if (editor) {
                (editor as any).updateBlock = originalUpdateBlock;
            }
        };
    }, [editor]);

    // 에디터가 마운트될 때 전역 editorContext 설정
    useEffect(() => {
        if (editor && pageId) {
            blocknoteLogger('Setting global editorContext when BlockNoteWrapper mounts', {
                editorExists: !!editor,
                pageId,
                editorType: editor?.constructor?.name || 'unknown',
            });

            // 전역 에디터 컨텍스트 설정 (page_creation 모드로 설정)
            setEditorContext({
                editor,
                mode: 'page_creation',
            });

            // 마운트 시 언마운트 플래그 초기화
            isUnmountingRef.current = false;
        }

        return () => {
            blocknoteLogger('Starting unmount process - setting unmounting flag', {
                pageId,
            });

            // 1단계: cleanup에서 setState를 사용하지 않고 ref를 사용 (React 베스트 프랙티스)
            // 이렇게 하면 즉시 리렌더링이 트리거되어 toolbars가 제거됨
            isUnmountingRef.current = true;

            // 2단계: React 렌더 사이클이 완료된 후 에디터 컨텍스트 정리
            // Promise.resolve()는 현재 실행 스택이 비워진 후 실행됨 (microtask queue)
            // 이는 FormattingToolbar cleanup이 완전히 완료된 후를 보장
            Promise.resolve().then(() => {
                blocknoteLogger('Clearing global editorContext after React render cycle', {
                    pageId,
                });

                setEditorContext({
                    editor: null,
                    mode: null,
                });
            });
        };
    }, [editor, pageId, setEditorContext]);

    useEffect(() => {
        if (isUploading) {
            openSnackbar({
                message: tEditor('uploading-files'),
                autoHideDuration: null,
                horizontal: 'left',
                vertical: 'bottom',
            });
        }
    }, [isUploading, tEditor, openSnackbar]);

    return (
        <div
            id="blocknote-container"
            ref={editorRef}
            className={`${styles.blockNoteContainer} ${darkMode ? styles.darkBlockNote : styles.lightBlockNote} ${hideSideMenu ? styles.hideSideMenu : ''}`}
            onDrop={handleDrop}
            onPaste={handlePaste}
        >
            <BlockNoteView
                editor={editor}
                theme={customTheme[darkMode ? 'dark' : 'light']}
                formattingToolbar={false}
                slashMenu={false}
                editable={!readOnly}
                spellCheck={false}
                autoFocus={false}
            >
                {/* AI 명령 메뉴 (AI가 활성화되고 언마운트 중이 아닐 때만) */}
                {!isUnmountingRef.current && isAIEnabled && <AIMenuController />}

                {/* 포맷팅 툴바 (언마운트 중이 아닐 때만 렌더링) */}
                {!isUnmountingRef.current && <FormattingToolbarWithAI hasAI={isAIEnabled} />}

                {/* 슬래시 메뉴 */}
                {!hideSideMenu && !readOnly && (
                    <SuggestionMenuController
                        triggerCharacter="/"
                        suggestionMenuComponent={CustomSlashMenu}
                        getItems={async (query) => {
                            const customItems = getCustomSlashMenuItems(editor, tEditor, pageId);
                            // AI가 활성화된 경우에만 AI 슬래시 메뉴 아이템 추가
                            const aiItems = isAIEnabled ? getAISlashMenuItems(editor) : [];

                            return filterSlashMenuItems([...customItems, ...aiItems], query);
                        }}
                    />
                )}
            </BlockNoteView>
        </div>
    );
};

export default BlockNoteWrapper;
