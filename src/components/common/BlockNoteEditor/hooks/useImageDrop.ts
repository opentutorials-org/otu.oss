import { useCallback, useRef, useState, useEffect } from 'react';
import { processFile } from '@/functions/uploadcare';
import { editorViewLogger } from '@/debug/editor';
import { useSetAtom } from 'jotai';
import { openSnackbarState } from '@/lib/jotai';

interface UploadResult {
    url: string | null;
    error?: Error;
}

interface UseImageDropProps {
    editor: any;
    pageId: string;
    t: (key: string) => string;
}

export const useImageDrop = ({ editor, pageId, t }: UseImageDropProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const openSnackbar = useSetAtom(openSnackbarState);

    // 복사 이벤트 처리: HTML 대신 일반 텍스트만 클립보드에 저장
    useEffect(() => {
        const handleCopy = (e: ClipboardEvent) => {
            // BlockNote 컨테이너 내부에서 발생한 복사인지 확인
            const target = e.target as HTMLElement;
            const blockNoteContainer = target.closest('#blocknote-container');

            if (!blockNoteContainer) return;

            try {
                // 현재 선택된 텍스트 가져오기
                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) return;

                const selectedText = selection.toString();
                if (!selectedText) return;

                // 기본 복사 동작 막기
                e.preventDefault();

                // 클립보드에 일반 텍스트만 저장
                e.clipboardData?.setData('text/plain', selectedText);

                editorViewLogger('Plain text copied to clipboard', {
                    textLength: selectedText.length,
                });
            } catch (error) {
                editorViewLogger('Copy event handling failed:', error);
            }
        };

        // 🔍 beforeinput 이벤트 추적 및 처리 (키보드 앱의 클립보드 히스토리 대응)
        const handleBeforeInput = (e: Event) => {
            const inputEvent = e as InputEvent;
            const target = inputEvent.target as HTMLElement;
            const blockNoteContainer = target.closest('#blocknote-container');

            if (!blockNoteContainer) return;

            const data = inputEvent.data || '';
            const hasNewlines = data.includes('\n') || data.includes('\r');

            // 🎯 안드로이드 키보드 앱 클립보드 히스토리 대응
            // insertText로 줄바꿈이 포함된 긴 텍스트가 들어오면 가로채서 처리
            if (inputEvent.inputType === 'insertText' && hasNewlines && data.length > 0) {
                // 안드로이드 환경 감지
                const isAndroid =
                    typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

                // 기본 동작 막기
                e.preventDefault();

                try {
                    if (isAndroid) {
                        // 안드로이드: BlockNote API 직접 사용
                        editor.insertInlineContent([{ type: 'text', text: data, styles: {} }]);
                        editorViewLogger(
                            'beforeinput : ✅ Android - Keyboard app paste handled via BlockNote API',
                            {
                                dataLength: data.length,
                                method: 'insertInlineContent',
                            }
                        );
                    }
                } catch (error) {
                    editorViewLogger('beforeinput : ❌ Primary method failed', {
                        error: error instanceof Error ? error.message : String(error),
                        isAndroid: isAndroid,
                    });
                }
            }
        };

        // 복사 이벤트 리스너 등록
        document.addEventListener('copy', handleCopy);
        document.addEventListener('beforeinput', handleBeforeInput, true);

        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('beforeinput', handleBeforeInput, true);
        };
    }, []);

    const extractImageUrlFromHtml = (html: string): string => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const imgElement = doc.querySelector('img');
        return imgElement?.src || '';
    };

    const uploadImage = async (file: File): Promise<UploadResult> => {
        try {
            const html = await processFile(file, pageId, abortControllerRef.current?.signal);
            const url = extractImageUrlFromHtml(html);
            return { url };
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return { url: null };
            }
            return {
                url: null,
                error: error instanceof Error ? error : new Error('Unknown error'),
            };
        }
    };

    const insertImage = (url: string, currentBlock: any) => {
        editor.insertBlocks(
            [
                {
                    type: 'image',
                    props: { url, caption: '' },
                },
            ],
            currentBlock,
            'before'
        );
    };

    const processImageFiles = async (files: File[]) => {
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));

        if (imageFiles.length === 0) return;

        editorViewLogger('Image files detected', { files: imageFiles });
        setIsUploading(true);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const currentBlock = editor.getTextCursorPosition().block;
        const uploadPromises = imageFiles.map((file) => uploadImage(file));

        try {
            const results = await Promise.all(uploadPromises);
            const successfulUploads = results.filter((result) => result.url !== null);

            successfulUploads.forEach((result) => {
                if (result.url) insertImage(result.url, currentBlock);
            });

            openSnackbar({
                message: t('all-images-uploaded'),
                autoHideDuration: 2000,
                horizontal: 'left',
                vertical: 'bottom',
            });

            editorViewLogger('All uploads completed', {
                total: imageFiles.length,
                successful: successfulUploads.length,
            });
        } catch (error) {
            editorViewLogger('Error processing files:', error);
        } finally {
            setIsUploading(false);
            abortControllerRef.current = null;
        }
    };

    const handleDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            const files = Array.from(e.dataTransfer.files || []);
            await processImageFiles(files);
        },
        [editor, pageId, t, openSnackbar]
    );

    const handlePaste = useCallback(
        async (e: React.ClipboardEvent<HTMLDivElement>) => {
            // 이미지 파일만 처리, 텍스트는 BlockNote 기본 동작에 맡김
            // (copy 이벤트에서 text/plain만 저장하므로 마크다운 형식 문제 해결됨)
            const files = Array.from(e.clipboardData.files || []);

            // 이미지 파일이 있으면 이미지 처리
            if (files.length > 0) {
                e.preventDefault();
                await processImageFiles(files);
            }
            // 텍스트 붙여넣기는 BlockNote 기본 동작에 위임 (중복 삽입 방지)
        },
        [editor, pageId, t, openSnackbar]
    );

    return {
        isUploading,
        handleDrop,
        handlePaste,
    };
};
