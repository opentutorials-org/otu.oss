'use client';
import { uploadLogger } from '@/debug/upload';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { currentPageState, openSnackbarState, runSyncState } from '@/lib/jotai';
import { useRouter } from 'next/navigation';
import { useLingui } from '@lingui/react/macro';
import { useCreate } from '@/components/home2/editor/hooks/useCreate';
import { processFile, fetchCaption, generatePageId, getUserId } from '@/functions/uploadcare';
import DOMPurify from 'dompurify';
import { fetchTitling } from '@/functions/ai';
import UploadIcon from '@mui/icons-material/Upload';
import Loading from '@/public/icon/loading';

export default function GlobalDragDrop() {
    const { t } = useLingui();
    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false); // 드래그 상태 추적
    const [userId, setUserId] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const router = useRouter();
    const { editSubmitHandler } = useCreate();
    const runSync = useSetAtom(runSyncState);
    const openSnackbar = useSetAtom(openSnackbarState);

    // 컴포넌트 언마운트 시 진행 중인 요청 취소
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    // root 엘리먼트에 blur 효과 적용/제거 함수
    const applyBlurEffect = useCallback((apply: boolean) => {
        const rootElement = document.getElementById('root');
        if (rootElement) {
            if (apply) {
                rootElement.style.filter = 'blur(3px)';
            } else {
                rootElement.style.filter = '';
            }
        }
    }, []);

    // 사용자 ID 가져오기
    useEffect(() => {
        const fetchUser = async () => {
            const id = await getUserId();
            setUserId(id);
        };
        fetchUser();
    }, []);

    // 파일 업로드 후 페이지 생성 함수
    const handleDirectSubmit = useCallback(
        async (content: string, pageId: string) => {
            // 붙여넣기된 내용은 전체가 본문으로 처리
            let bodyPart = content;
            // 임시 제목 설정
            let titlePart = t`제목 없음`;

            // 이미지가 포함되어 있는지 확인
            const hasImage = content.includes('<img');

            // 페이지 생성
            await editSubmitHandler(titlePart, bodyPart, false, pageId, 'text');
            runSync({});

            // 페이지 생성 후 해당 페이지로 이동
            const url = '/home/page/' + pageId;
            router.push(url);
            setCurrentPage({ type: 'PAGE_READ', id: pageId, path: url });
        },
        [t, editSubmitHandler, runSync, router, setCurrentPage]
    );

    // 클립보드 이미지 붙여넣기 처리 함수
    const handlePaste = useCallback(
        async (e: ClipboardEvent) => {
            // 다른 입력 필드에 포커스가 있는지 확인
            const activeElement = document.activeElement;
            const isTextAreaFocused =
                activeElement &&
                (activeElement.tagName === 'TEXTAREA' ||
                    activeElement.tagName === 'INPUT' ||
                    activeElement.getAttribute('contenteditable') === 'true');

            // 텍스트 영역에 포커스가 있으면 일반적인 붙여넣기 동작 수행
            if (isTextAreaFocused) return;

            // HOME 페이지가 아니면 처리하지 않음
            if (currentPage.type !== 'HOME') return;

            const items = e.clipboardData?.items;
            if (!items) return;

            // 파일이 있는지 확인
            let hasFile = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file') {
                    hasFile = true;
                    break;
                }
            }

            // 파일이 있으면 파일 처리 로직으로 진행
            if (hasFile) {
                e.preventDefault();

                let fileStr = '';
                let pageId = generatePageId();
                let titlePart = t`제목 없음`; // 기본 제목

                // 파일 처리 시작
                const filePromises = [];
                for (let i = 0; i < items.length; i++) {
                    if (items[i].kind === 'file') {
                        const file = items[i].getAsFile();
                        if (!file) continue;

                        // 파일명을 제목으로 사용
                        if (file.name) {
                            titlePart = file.name;
                        }

                        // 비동기 처리를 위한 Promise 생성 및 저장
                        const promise = processFile(
                            file,
                            pageId,
                            abortControllerRef.current?.signal
                        )
                            .then((insertHtml) => {
                                fileStr += insertHtml;
                                return insertHtml;
                            })
                            .catch((error) => {
                                // AbortError는 정상적인 취소로 간주
                                if (error instanceof Error && error.name === 'AbortError') {
                                    uploadLogger('File upload aborted');
                                    return null;
                                }
                                console.error('파일 업로드 오류:', error);
                                openSnackbar({
                                    message: t`파일 업로드에 실패했습니다.`,
                                });
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

                    if (fileStr) {
                        // 제목과 내용으로 페이지 생성 (자동 제목 생성 기능 사용하지 않음)
                        const bodyPart = fileStr;
                        await editSubmitHandler(titlePart, bodyPart, false, pageId, 'text');
                        runSync({});

                        // 페이지 생성 후 해당 페이지로 이동
                        const url = '/home/page/' + pageId;
                        router.push(url);
                        setCurrentPage({ type: 'PAGE_READ', id: pageId, path: url });
                    }
                }
            }
            // 파일이 없고 텍스트가 있으면 HTML 처리
            else {
                // HTML 형식의 데이터 가져오기
                const htmlContent = e.clipboardData?.getData('text/html');
                const plainText = e.clipboardData?.getData('text/plain');

                // HTML이나 텍스트가 있는지 확인
                if (
                    (!htmlContent || htmlContent.trim().length === 0) &&
                    (!plainText || plainText.trim().length === 0)
                ) {
                    return;
                }

                e.preventDefault(); // 기본 붙여넣기 동작 방지

                // 페이지 생성 로직
                const pageId = generatePageId();
                let content = '';
                let titlePart = t`제목 없음`; // 기본 제목

                // 텍스트에서 첫 줄이나 문장을 제목으로 사용
                if (plainText && plainText.trim().length > 0) {
                    // 첫 줄을 기준으로 제목 설정
                    const firstLine = plainText.split('\n')[0].trim();
                    if (firstLine.length > 0) {
                        // 첫 줄이 너무 길면 자르기
                        titlePart =
                            firstLine.length > 100 ? firstLine.substring(0, 97) + '...' : firstLine;
                    } else {
                        // 첫 줄이 비어있으면 첫 문장 사용
                        const firstSentence = plainText.split(/[.!?]\s+/)[0].trim();
                        if (firstSentence.length > 0) {
                            titlePart =
                                firstSentence.length > 100
                                    ? firstSentence.substring(0, 97) + '...'
                                    : firstSentence;
                        }
                    }
                }

                // HTML이 있으면 HTML 사용, 없으면 일반 텍스트 사용
                if (htmlContent && htmlContent.trim().length > 0) {
                    // 스타일 필터링을 위한 후크 설정
                    DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
                        // style 속성을 처리
                        if (data.attrName === 'style') {
                            // CSS 스타일 문자열에서 배경색과 텍스트 색상 제거
                            const style = data.attrValue;
                            const filteredStyle = style
                                .replace(/background(-color)?:\s*[^;]+;?/gi, '')
                                .replace(/color:\s*[^;]+;?/gi, '');

                            // 필터링된 스타일로 대체
                            data.attrValue = filteredStyle;
                        }
                    });

                    // DOMPurify로 HTML 정제
                    content = DOMPurify.sanitize(htmlContent, {
                        ALLOWED_TAGS: [
                            'a',
                            'p',
                            'span',
                            'b',
                            'i',
                            'u',
                            'strong',
                            'em',
                            'h1',
                            'h2',
                            'h3',
                            'h4',
                            'h5',
                            'h6',
                            'ul',
                            'ol',
                            'li',
                            'br',
                            'div',
                            'img',
                            'pre',
                            'code',
                            'blockquote',
                            'hr',
                            'table',
                            'thead',
                            'tbody',
                            'tr',
                            'th',
                            'td',
                        ],
                        ALLOWED_ATTR: [
                            'href',
                            'target',
                            'style',
                            'src',
                            'alt',
                            'title',
                            'width',
                            'height',
                            'class',
                        ],
                        KEEP_CONTENT: true,
                        RETURN_DOM_FRAGMENT: false,
                        RETURN_DOM: false,
                    });

                    // 후크 제거 (다음 사용 시 간섭 방지)
                    DOMPurify.removeHook('uponSanitizeAttribute');

                    // 정제된 HTML이 비어있으면 일반 텍스트로 대체
                    if (!content || content.trim().length === 0) {
                        content = `<p>${plainText.replace(/\n/g, '</p><p>')}</p>`;
                    }
                } else {
                    // 일반 텍스트를 HTML로 변환
                    content = `<p>${plainText.replace(/\n/g, '</p><p>')}</p>`;
                }

                // 빈 단락 제거
                content = content.replace(/<p>\s*<\/p>/g, '');

                if (content) {
                    // 제목과 내용으로 페이지 생성 (자동 제목 생성 기능 사용하지 않음)
                    await editSubmitHandler(titlePart, content, false, pageId, 'text');
                    runSync({});

                    // 페이지 생성 후 해당 페이지로 이동
                    const url = '/home/page/' + pageId;
                    router.push(url);
                    setCurrentPage({ type: 'PAGE_READ', id: pageId, path: url });
                }
            }
        },
        [
            currentPage.type,
            userId,
            editSubmitHandler,
            runSync,
            router,
            setCurrentPage,
            t,
            openSnackbar,
            setIsUploading,
        ]
    );

    // 드래그 앤 드롭 처리 함수
    const handleDrop = useCallback(
        async (e: DragEvent) => {
            if (currentPage.type !== 'HOME') return;

            e.preventDefault();
            e.stopPropagation();

            // 드래그 상태 종료
            setIsDragging(false);
            document.body.classList.remove('drag-over');

            // blur 효과 제거
            applyBlurEffect(false);

            const dt = e.dataTransfer;
            if (!dt) return;

            let fileStr = '';
            let pageId = generatePageId();

            if (dt.files.length === 0) return;

            // 이전 요청이 있으면 취소
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // 새 AbortController 생성
            abortControllerRef.current = new AbortController();

            // 파일 처리 시작
            const filePromises = [];
            for (let i = 0; i < dt.files.length; i++) {
                const file = dt.files[i];
                if (!file) continue;

                // 비동기 처리를 위한 Promise 생성 및 저장
                const promise = processFile(file, pageId, abortControllerRef.current.signal)
                    .then((insertHtml) => {
                        fileStr += insertHtml;
                        return insertHtml;
                    })
                    .catch((error) => {
                        // AbortError는 정상적인 취소로 간주
                        if (error instanceof Error && error.name === 'AbortError') {
                            uploadLogger('File upload aborted');
                            return null;
                        }
                        console.error('파일 업로드 오류:', error);
                        openSnackbar({
                            message: t`파일 업로드에 실패했습니다.`,
                        });
                        return null;
                    });

                filePromises.push(promise);
            }

            // 모든 파일 처리 완료 대기
            if (filePromises.length > 0) {
                setIsUploading(true);
                try {
                    await Promise.all(filePromises);
                } finally {
                    setIsUploading(false);
                }

                if (fileStr) {
                    await handleDirectSubmit(fileStr, pageId);
                }
            }
        },
        [
            currentPage.type,
            userId,
            setIsUploading,
            openSnackbar,
            t,
            handleDirectSubmit,
            applyBlurEffect,
        ]
    );

    // 드래그 오버 이벤트 처리
    const handleDragOver = useCallback(
        (e: DragEvent) => {
            if (currentPage.type !== 'HOME') return;
            e.preventDefault();
            e.stopPropagation();

            // 드래그 상태 활성화
            if (!isDragging) {
                setIsDragging(true);
                document.body.classList.add('drag-over');

                // blur 효과 적용
                applyBlurEffect(true);
            }
        },
        [currentPage.type, isDragging, applyBlurEffect]
    );

    // 드래그 진입 이벤트 처리
    const handleDragEnter = useCallback(
        (e: DragEvent) => {
            if (currentPage.type !== 'HOME') return;
            e.preventDefault();
            e.stopPropagation();

            // 드래그 상태 활성화
            setIsDragging(true);
            document.body.classList.add('drag-over');

            // blur 효과 적용
            applyBlurEffect(true);
        },
        [currentPage.type, applyBlurEffect]
    );

    // 드래그 나가기 이벤트 처리
    const handleDragLeave = useCallback(
        (e: DragEvent) => {
            if (currentPage.type !== 'HOME') return;
            e.preventDefault();
            e.stopPropagation();

            // 마우스가 body 영역을 벗어났을 때만 클래스 제거
            const rect = document.body.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;

            if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
                setIsDragging(false);
                document.body.classList.remove('drag-over');

                // blur 효과 제거
                applyBlurEffect(false);
            }
        },
        [currentPage.type, applyBlurEffect]
    );

    // body에 이벤트 리스너 추가
    useEffect(() => {
        // 이벤트 리스너 등록
        document.body.addEventListener('paste', handlePaste);
        document.body.addEventListener('drop', handleDrop);
        document.body.addEventListener('dragover', handleDragOver);
        document.body.addEventListener('dragenter', handleDragEnter);
        document.body.addEventListener('dragleave', handleDragLeave);

        // 컴포넌트 언마운트 시 이벤트 리스너 제거
        return () => {
            document.body.removeEventListener('paste', handlePaste);
            document.body.removeEventListener('drop', handleDrop);
            document.body.removeEventListener('dragover', handleDragOver);
            document.body.removeEventListener('dragenter', handleDragEnter);
            document.body.removeEventListener('dragleave', handleDragLeave);

            // 언마운트 시 blur 효과 제거 (안전장치)
            applyBlurEffect(false);
        };
    }, [
        handlePaste,
        handleDrop,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        applyBlurEffect,
    ]);

    return (
        <>
            {isUploading && (
                <div className="fixed inset-0 flex items-center justify-center z-50 ">
                    <Loading sx={{ fontSize: '4rem' }} />
                </div>
            )}
            {isDragging && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <UploadIcon sx={{ fontSize: '10rem' }} />
                </div>
            )}
        </>
    );
}
