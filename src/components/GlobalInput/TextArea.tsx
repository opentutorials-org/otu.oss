import { focusGlobalInputRandomState, mainScrollPaneState } from '@/lib/jotai';
import { useAtomValue } from 'jotai';
import React, { useEffect, useRef, forwardRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import {
    generatePageId,
    processFile,
    getUserId,
    fetchCaption,
    generateDownloadLink,
} from '@/functions/uploadcare';
import { uploadLogger } from '@/debug/upload';
import get from 'lodash/get';

interface Props {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onEnter: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder: string;
    onBlur: () => void;
    mode: string;
    pageId?: string;
    onDirectSubmit?: (content: string, pageId: string) => Promise<void>;
    maxLength?: number;
}

const TextArea = forwardRef<HTMLTextAreaElement, Props>(
    (
        { mode, value, onChange, onEnter, onBlur, placeholder, pageId, onDirectSubmit, maxLength },
        ref
    ) => {
        const inputRef = useRef<HTMLTextAreaElement | null>(null);
        const mainScrollPane = useAtomValue(mainScrollPaneState) as HTMLDivElement | null;
        const [isComposing, setIsComposing] = React.useState(false);
        const focusInput = useAtomValue(focusGlobalInputRandomState);
        const [isLoading, setIsLoading] = React.useState(false);
        const [userId, setUserId] = React.useState<string | null>(null);
        const [isUploading, setIsUploading] = React.useState(false);

        useEffect(() => {
            const fetchUser = async () => {
                const id = await getUserId();
                setUserId(id);
            };
            fetchUser();
        }, []);

        useEffect(() => {
            if (!mainScrollPane) return;

            const handleScroll = () => {
                inputRef.current?.blur();
            };

            mainScrollPane.addEventListener('scroll', handleScroll);
            return () => {
                mainScrollPane.removeEventListener('scroll', handleScroll);
            };
        }, [mainScrollPane]);

        useEffect(() => {
            setIsLoading(true);
        }, []);

        const onKeyDownHandler = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !isComposing) {
                onEnter(e);
                e.preventDefault();
            }
        };

        useEffect(() => {
            if (focusInput.mode === mode) {
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 10);
            }
        }, [focusInput.mode, focusInput.seed, mode]);

        // 클립보드 이미지 붙여넣기 처리 함수
        const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
            const items = e.clipboardData.items;
            let fileStr = '';
            let hasFile = false;
            let pageId = generatePageId();
            uploadLogger('클립보드 항목 수:', items.length); // 디버깅용

            // 먼저 파일 여부 확인
            for (let i = 0; i < items.length; i++) {
                uploadLogger(`항목 ${i} 종류:`, items[i].kind, items[i].type); // 디버깅용
                if (items[i].kind === 'file') {
                    hasFile = true;
                }
            }

            // 파일이 있을 경우에만 기본 동작 방지
            if (hasFile) {
                e.preventDefault();
            } else {
                // 파일이 없으면 (텍스트만 있으면) 기본 동작 유지
                return;
            }

            // 파일 처리 시작
            const filePromises = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    const file = items[i].getAsFile();
                    if (!file) continue;

                    // 비동기 처리를 위한 Promise 생성 및 저장
                    const promise = processFile(file, pageId)
                        .then((insertHtml) => {
                            fileStr += insertHtml;
                            return insertHtml;
                        })
                        .catch((error) => {
                            uploadLogger('파일 업로드 오류:', error);
                            alert('파일 업로드에 실패했습니다.'); // todo snackbar로 변경
                            return null;
                        });

                    filePromises.push(promise);
                }
            }

            // 모든 파일 처리 완료 대기
            if (filePromises.length > 0) {
                setIsUploading(true);
                try {
                    await Promise.all(filePromises);
                } finally {
                    setIsUploading(false);
                }

                if (fileStr && onDirectSubmit) {
                    onDirectSubmit(fileStr, pageId);
                }
            }
        };

        if (!isLoading) {
            return <></>;
        }

        return (
            <div className="relative w-full flex items-center">
                <TextareaAutosize
                    id="quick_input"
                    ref={(textareaNode) => {
                        // 내부 ref 설정
                        inputRef.current = textareaNode;

                        // 외부 ref 전달
                        if (typeof ref === 'function') {
                            ref(textareaNode);
                        } else if (ref) {
                            (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
                                textareaNode;
                        }
                    }}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    className={`p-1 px-[0.5rem] border-none outline-none focus-bg-color text-color w-full h-full resize-none ${isUploading ? 'opacity-50' : ''} placeholder-text-color`}
                    autoFocus
                    value={value}
                    placeholder={isUploading ? '파일 업로드 중...' : placeholder}
                    onBlur={onBlur}
                    onChange={onChange}
                    onKeyDown={onKeyDownHandler}
                    onPaste={handlePaste}
                    disabled={isUploading}
                    maxLength={maxLength}
                />
            </div>
        );
    }
);

export default TextArea;
