'use client';

import { uploaderLogger } from '@/debug/uploader';
import { extractBodyInfo } from '@/functions/extractBodyInfo';
import {
    currentPageState,
    fileUploaderOpenState,
    openFileUploaderState,
    openSnackbarState,
    refreshSeedAfterContentUpdate,
    runSyncState,
    updateCurrentPageContentState,
    isTitleLoadingState,
    setIsTitleLoadingState,
    editorUploaderContextState,
    themeModeState,
    refreshListState,
} from '@/lib/jotai';
import { FileUploaderRegular, UploadCtxProvider, UploadcareFile } from '@uploadcare/react-uploader';
import '@uploadcare/react-uploader/core.css';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useLayoutEffect, useRef, useState, memo } from 'react';
import { create, update } from '@/watermelondb/control/Page';
import { useLingui } from '@lingui/react/macro';
import './style.css';
import { ulid } from 'ulid';
import { fetchUserId, createClient } from '@/supabase/utils/client';
import { useNavigation } from '@/hooks/useNavigation';
import {
    IMAGE_SHRINK_POLICY_HEIGHT,
    IMAGE_SHRINK_POLICY_STRING,
    IMAGE_SHRINK_POLICY_WIDTH,
} from '@/functions/constants';

if (process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY === undefined) {
    throw new Error(
        'NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY가 존재하지 않습니다. .env.template을 참조해서 .env 파일에 추가해주세요.'
    );
}

function removePreviewFromCdnUrl(cdnUrl: string): string {
    uploaderLogger('removePreviewFromCdnUrl - Start', { cdnUrl });
    const regex = /-\/preview\/?(\d+x\d+)?\/?$/;
    const match = cdnUrl.match(regex);
    if (match) {
        const result = cdnUrl.replace(match[0], '').replace(/\/?$/, '/');
        uploaderLogger('removePreviewFromCdnUrl - Preview removed', { original: cdnUrl, result });
        return result;
    }
    uploaderLogger('removePreviewFromCdnUrl - No preview pattern found', { cdnUrl });
    return cdnUrl;
}

function generateDownloadLink(fileUrl: string, fileName: string): string {
    uploaderLogger('generateDownloadLink - Creating download link', { fileUrl, fileName });
    return `<div class="download"><a href="${fileUrl}" download="${fileName}" target="_blank">${fileName}</a></div>`;
}

function getCurrentPageIdFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const pathname = window.location.pathname;
    const match = pathname.match(/\/page\/([^\/]+)/);
    return match ? match[1] : null;
}

async function fetchCaption(id: string, imageUrl: string, signal?: AbortSignal) {
    uploaderLogger('fetchCaption - Start', { id, imageUrl });
    try {
        uploaderLogger('fetchCaption - Making API request');
        const response = await fetch('/api/ai/captioning', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, image_url: imageUrl }),
            signal: signal,
        });

        if (!response.ok) {
            uploaderLogger('fetchCaption - HTTP error', { status: response.status });

            // HTTP 429 (사용량 한도 초과) 처리
            if (response.status === 429) {
                try {
                    const errorData = await response.json();

                    // OTU 사용량 한도 초과 vs OpenAI API 한도 초과 구분
                    const isUserQuotaExceeded = errorData.code === 'user_quota_exceeded';
                    const isExternalRateLimit = errorData.code === 'external_service_rate_limit';

                    if (isUserQuotaExceeded) {
                        // OTU 사용량 한도 초과 - 리셋 날짜 정보 포함
                        const quotaError: any = new Error(
                            errorData.error ||
                                '월간 AI 사용량이 초과되었습니다. 다음 달에 다시 시도해주세요.'
                        );
                        quotaError.isQuotaExceeded = true;
                        quotaError.status = 429;
                        quotaError.resetInfo = errorData.error; // "다음 초기화 일자: ..." 포함
                        uploaderLogger('fetchCaption - User quota exceeded', {
                            message: quotaError.message,
                        });
                        throw quotaError;
                    } else if (isExternalRateLimit) {
                        // OpenAI API 한도 초과 - 재시도 안내
                        const rateLimitError: any = new Error(
                            errorData.error ||
                                'OpenAI API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
                        );
                        rateLimitError.isExternalRateLimit = true;
                        rateLimitError.status = 429;
                        uploaderLogger('fetchCaption - External rate limit', {
                            message: rateLimitError.message,
                        });
                        throw rateLimitError;
                    } else {
                        // 하위 호환성: code가 없는 경우 기존 동작 유지
                        const quotaError: any = new Error(
                            errorData.error ||
                                '월간 AI 사용량이 초과되었습니다. 다음 달에 다시 시도해주세요.'
                        );
                        quotaError.isQuotaExceeded = true;
                        quotaError.status = 429;
                        quotaError.resetInfo = errorData.error;
                        uploaderLogger('fetchCaption - Quota exceeded (legacy)', {
                            message: quotaError.message,
                        });
                        throw quotaError;
                    }
                } catch (parseError) {
                    // parseError가 quotaError 또는 rateLimitError인 경우 그대로 throw
                    if (
                        (parseError as any).isQuotaExceeded ||
                        (parseError as any).isExternalRateLimit
                    ) {
                        throw parseError;
                    }

                    // 실제 JSON 파싱 실패는 서버 오류로 처리
                    console.error('HTTP 429 응답의 JSON 파싱 실패:', parseError);
                    console.error('File uploader error:', parseError, {
                        tags: {
                            api: 'captioning',
                            status: 429,
                            errorType: 'json_parse_failure',
                        },
                        extra: {
                            parseError:
                                parseError instanceof Error
                                    ? parseError.message
                                    : String(parseError),
                        },
                    });

                    throw new Error(
                        `Captioning API 응답 파싱 실패: ${response.status} ${response.statusText}`
                    );
                }
            }

            throw new Error(`HTTP error! status: ${response.status}`);
        }

        uploaderLogger('fetchCaption - Parsing JSON response');
        const responseData = await response.json();
        uploaderLogger('fetchCaption - Response received', { responseData });
        return responseData;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            uploaderLogger('fetchCaption - Fetch caption aborted', { error });
            throw error;
        }
        uploaderLogger('fetchCaption - Error fetching caption', error);
        throw error;
    }
}

export default memo(function FileUploader() {
    uploaderLogger('FileUploader rendering started');

    const uploaderRef = useRef<InstanceType<typeof UploadCtxProvider> | null>(null);
    const fileUploaderOpen = useAtomValue(fileUploaderOpenState);
    const openFileUploader = useSetAtom(openFileUploaderState);
    const uploadedFilesRef = useRef<UploadcareFile[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const themeMode = useAtomValue(themeModeState);
    const isDarkMode = themeMode === 'black';

    const refreshList = useSetAtom(refreshListState);
    const runSync = useSetAtom(runSyncState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const { t } = useLingui();
    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const updateCurrentPageContent = useSetAtom(updateCurrentPageContentState);
    const [pageId, setPageId] = useState<null | string>(null);
    const [userId, setUserId] = useState<null | string>(null);
    const setIsTitleLoading = useSetAtom(setIsTitleLoadingState);
    const editorContext = useAtomValue(editorUploaderContextState);
    const setEditorContext = useSetAtom(editorUploaderContextState);
    const editorContextRef = useRef(editorContext);
    const { navigateToPageEdit } = useNavigation();

    // editorContext가 변경될 때마다 ref 업데이트
    useEffect(() => {
        editorContextRef.current = editorContext;
        uploaderLogger('Updated editorContextRef with latest context', {
            hasEditor: !!editorContext.editor,
            mode: editorContext.mode,
            editorType: editorContext.editor?.constructor?.name || 'none',
        });
    }, [editorContext]);

    // openEditorUploader 이벤트 리스너 추가
    useEffect(() => {
        const handleOpenEditorUploader = (event: CustomEvent) => {
            uploaderLogger('handleOpenEditorUploader - Event received', {
                detail: event.detail,
            });

            const { editor, mode } = event.detail;

            // 에디터 컨텍스트 설정
            setEditorContext({
                editor,
                mode,
            });

            // 업로더 열기
            openFileUploader({ open: true });
        };

        // 이벤트 리스너 등록
        window.addEventListener('openEditorUploader', handleOpenEditorUploader as EventListener);

        // 클린업 함수
        return () => {
            window.removeEventListener(
                'openEditorUploader',
                handleOpenEditorUploader as EventListener
            );
        };
    }, [setEditorContext, openFileUploader]);

    // 컴포넌트가 마운트될 때 pageId 생성 및 업로더 실행 (isHydrated 확인 후 실행)
    useEffect(() => {
        if (fileUploaderOpen && isHydrated) {
            uploaderLogger('useEffect - Setting pageId and initializing flow');
            const newPageId = ulid();
            uploaderLogger('useEffect - Generated new pageId', { newPageId });
            setPageId(newPageId);

            if (uploaderRef.current) {
                uploaderLogger('useEffect - Uploader ref exists, initializing flow');
                uploaderRef.current.getAPI().initFlow();
            } else {
                uploaderLogger('useEffect - Uploader ref is null, cannot initialize flow');
            }
        }
    }, [fileUploaderOpen, isHydrated, openFileUploader]);

    useEffect(() => {
        uploaderLogger('useEffect - Component mounting');
        setIsHydrated(true);
        uploaderLogger('useEffect - setIsHydrated(true) called');

        return () => {
            uploaderLogger('useEffect - Component unmounting or cleanup');
            if (abortControllerRef.current) {
                uploaderLogger('useEffect - Aborting fetchCaption');
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        uploaderLogger('useEffect - Fetching userId');
        (async () => {
            try {
                uploaderLogger('useEffect - Before fetchUserId call');
                const id = await fetchUserId();
                uploaderLogger('useEffect - Setting userId', { id });
                setUserId(id);
            } catch (error) {
                uploaderLogger('useEffect - Error in fetchUserId', { error });
                console.error('File uploader error:', error);
                uploaderLogger('Error fetching user ID', error);
            }
        })();
    }, []);

    const handleUploadFinish = (e: any) => {
        uploaderLogger('handleUploadFinish - Upload finished', {
            event: e,
            filesCount: e.allEntries?.length || 0,
            beforeCount: uploadedFilesRef.current?.length || 0,
        });
        uploadedFilesRef.current = e.allEntries;
    };

    const handleFileUrlChanged = (e: any) => {
        uploaderLogger('handleFileUrlChanged - Updating URLs', {
            uuid: e.uuid,
            newCdnUrl: e.cdnUrl,
        });
        uploadedFilesRef.current = uploadedFilesRef.current.map((item) => {
            if (item.uuid === e.uuid) {
                return { ...item, cdnUrl: e.cdnUrl };
            }
            return item;
        });
    };

    const handleDoneClick = async () => {
        uploaderLogger('handleDoneClick - Start');

        if (pageId === null) {
            uploaderLogger('handleDoneClick - Error: pageId is null');
            throw new Error('pageId is null');
        }

        uploaderLogger('handleDoneFlow - Start', {
            'uploadedFilesRef.current': uploadedFilesRef.current,
            pageId: pageId,
        });

        if (pageId === null) {
            uploaderLogger('handleDoneClick - Error: pageId is null (redundant check)');
            throw new Error('id is null');
        }

        if (uploadedFilesRef.current.length === 0) {
            uploaderLogger('handleDoneFlow - No uploaded files found');
            return;
        }

        if (!isHydrated) {
            uploaderLogger('handleDoneClick - Ignored: Not hydrated');
            return;
        }

        // 에디터 모드일 경우 에디터에 파일 삽입
        if (editorContext?.mode === 'editor_insert' && editorContext?.editor) {
            uploaderLogger('handleDoneClick - Editor insert mode detected', {
                editorContext,
                fileCount: uploadedFilesRef.current.length,
            });
            const editor = editorContext.editor;

            // 현재 커서 위치의 블록
            const currentBlock = editor.getTextCursorPosition().block;

            for (const file of uploadedFilesRef.current) {
                const isImage = file.isImage;
                const isVideo = file.mimeType?.startsWith('video/');
                const fileUrl = file.cdnUrl || '';
                const fileName = file.name || 'Unknown File';

                uploaderLogger('handleDoneClick - Processing file for editor', {
                    isImage,
                    isVideo,
                    name: fileName,
                    fileUrl,
                });

                if (isImage) {
                    const imageUrl = `${removePreviewFromCdnUrl(
                        fileUrl
                    )}-/preview/${IMAGE_SHRINK_POLICY_WIDTH}x${IMAGE_SHRINK_POLICY_HEIGHT}/`;

                    uploaderLogger('handleDoneClick - Inserting image block', { imageUrl });
                    // 이미지 삽입
                    editor.insertBlocks(
                        [
                            {
                                type: 'image',
                                props: {
                                    url: imageUrl,
                                    caption: '',
                                },
                            },
                        ],
                        currentBlock,
                        'before'
                    );
                } else if (isVideo) {
                    uploaderLogger('handleDoneClick - Inserting video block', { fileUrl });
                    editor.insertBlocks(
                        [
                            {
                                type: 'video',
                                props: {
                                    url: fileUrl,
                                    caption: '',
                                },
                            },
                        ],
                        currentBlock,
                        'before'
                    );
                } else {
                    uploaderLogger('handleDoneClick - Inserting file link', { fileName, fileUrl });
                    editor.insertBlocks(
                        [
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'link',
                                        href: fileUrl,
                                        content: [
                                            {
                                                type: 'text',
                                                text: fileName,
                                                styles: {},
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                        currentBlock,
                        'before'
                    );
                }
            }

            // 업로더 닫기
            uploaderLogger('handleDoneClick - Editor mode completed, closing uploader');
            uploaderRef.current?.getAPI().removeAllFiles();
            uploadedFilesRef.current = [];
            openFileUploader({ open: false });
            // 에디터 컨텍스트 초기화
            setEditorContext({
                editor: null,
                mode: null,
            });
            return;
        }

        // 기존 페이지 생성 로직
        uploaderLogger('handleDoneClick - Starting regular page creation flow');
        uploaderLogger('handleDoneClick - Mapping files to HTML');
        const files = uploadedFilesRef.current.map((item, index) => {
            uploaderLogger(`handleDoneClick - Processing file ${index + 1}`, {
                name: item.name,
                isImage: item.isImage,
            });

            const isImage = item.isImage;

            if (isImage) {
                uploaderLogger(`handleDoneClick - Processing image file ${index + 1}`);
                const SCREEN_SIZE = 564;
                const imageWidth = Number(item?.contentInfo?.image?.width) || SCREEN_SIZE;
                const imageHeight = Number(item?.contentInfo?.image?.height) || SCREEN_SIZE;

                uploaderLogger(`handleDoneClick - Image dimensions`, {
                    originalWidth: imageWidth,
                    originalHeight: imageHeight,
                });

                // Calculate the display dimensions
                const displayWidth = Math.min(SCREEN_SIZE, imageWidth);
                const displayHeight = Math.min(SCREEN_SIZE, imageHeight);

                uploaderLogger(`handleDoneClick - Display dimensions`, {
                    displayWidth,
                    displayHeight,
                });

                // Use 'limit' operation to prevent upscaling
                const imageUrl = `${removePreviewFromCdnUrl(
                    item.cdnUrl || ''
                )}-/preview/${IMAGE_SHRINK_POLICY_WIDTH}x${IMAGE_SHRINK_POLICY_HEIGHT}/`;

                return `<img src="${imageUrl}" />`;
            } else {
                uploaderLogger(`handleDoneClick - Processing non-image file ${index + 1}`);
                const fileUrl = item.cdnUrl || '';
                const fileName = item.name || 'Unknown File';
                uploaderLogger(`handleDoneClick - File download link`, {
                    fileName,
                    fileUrl,
                });
                return generateDownloadLink(fileUrl, fileName);
            }
        });

        let body = files.join('\n');
        uploaderLogger('handleDoneClick - Combined body created', { bodyLength: body.length });

        const firstFile = uploadedFilesRef.current[0];
        const fileName = firstFile.name || 'Untitled';
        uploaderLogger('handleDoneClick - First file info', {
            fileName,
            isImage: firstFile.isImage,
        });

        let title = (firstFile.isImage ? t`제목 작성 중...` : fileName) || t`제목 없음`;
        uploaderLogger('handleDoneClick - Initial title set', { title });

        uploaderLogger('handleDoneClick - Extracting body info');
        const { length, img_url } = extractBodyInfo(title, body);
        uploaderLogger('handleDoneClick - Body info extracted', { length, img_url });
        uploaderLogger('handleDoneClick - Initial title set', { title });

        uploaderLogger('handleDoneClick - Creating page content', {
            id: pageId,
            title,
            bodyLength: body.length,
            isPublic: false,
        });

        await create({
            id: pageId,
            title,
            body,
            is_public: false,
            length,
            img_url,
            type: 'text',
        })
            .then(async (result) => {
                uploaderLogger('handleDoneClick - Content created', {
                    result,
                    newPath: `/home/page/${result.id}`,
                });

                // React Router DOM 기반 네비게이션 사용
                navigateToPageEdit(result.id);

                // 상태 업데이트 통합
                uploaderLogger('handleDoneClick - Updating application state');
                // 파일 업로드 후 목록 갱신을 즉시+1초 후 실행 (외과수술적 업데이트)
                refreshList({
                    source: 'components/home/logined/fileUploader:handleDoneClick',
                    pageId: result.id,
                    action: 'create',
                });
                updateCurrentPageContent({
                    id: result.id,
                    title,
                    body,
                });

                if (firstFile.isImage) {
                    uploaderLogger('handleDoneClick - Starting image caption process', {
                        cdnUrl: firstFile.cdnUrl || '',
                        id: result.id,
                    });

                    const cdnUrl = firstFile.cdnUrl || '';

                    // if (abortControllerRef.current) {
                    //     abortControllerRef.current.abort();
                    // }

                    setIsTitleLoading(true);

                    abortControllerRef.current = new AbortController();
                    const captionUrl = `${cdnUrl}-/preview/720x720/`;

                    fetchCaption(result.id, captionUrl, abortControllerRef.current.signal)
                        .then(async (titleResult) => {
                            uploaderLogger('handleDoneClick - Caption fetched', {
                                titleResult,
                                oldTitle: title,
                            });

                            const oldTitle = title;
                            title = titleResult.result.title || t`제목 작성 중...`;

                            const ocr = titleResult.result.ocr || null;
                            let bodyUpdated = false;
                            if (ocr && ocr.trim().length > 0) {
                                body += `<p>${ocr}</p>`;
                                bodyUpdated = true;
                            }

                            uploaderLogger('handleDoneClick - Updating content with caption/OCR', {
                                id: result.id,
                                titleChanged: oldTitle !== title,
                                bodyUpdated,
                                newTitle: title,
                            });

                            // 항상 DB를 먼저 업데이트하여 목록 화면에 머물러도 제목/OCR이 저장되도록 함
                            await update({
                                id: result.id,
                                title,
                                body,
                                is_public: false,
                                length,
                                img_url,
                                type: 'text',
                            });

                            const currentPageIdFromUrl = getCurrentPageIdFromUrl();
                            const isSameId = currentPageIdFromUrl === result.id;
                            uploaderLogger(
                                'handleDoneClick - Step 2: DB updated. Checking page match and trying editor update',
                                {
                                    currentPageIdFromUrl,
                                    resultId: result.id,
                                    isSameId,
                                    windowLocation:
                                        typeof window !== 'undefined'
                                            ? window.location.pathname
                                            : 'SSR',
                                    editorContext: editorContextRef.current,
                                }
                            );

                            if (isSameId) {
                                try {
                                    // 우선 전역 editorContext에서 에디터 찾기 (최신 참조)
                                    const currentEditorContext = editorContextRef.current;
                                    if (currentEditorContext.editor) {
                                        uploaderLogger(
                                            'handleDoneClick - Found editor via global context, updating directly',
                                            {
                                                editorType:
                                                    currentEditorContext.editor?.constructor
                                                        ?.name || 'unknown',
                                                mode: currentEditorContext.mode,
                                            }
                                        );

                                        // HTML을 BlockNote 블록으로 변환하여 에디터 업데이트
                                        const blocks =
                                            await currentEditorContext.editor.tryParseHTMLToBlocks(
                                                body
                                            );
                                        currentEditorContext.editor.replaceBlocks(
                                            currentEditorContext.editor.document,
                                            blocks
                                        );
                                        uploaderLogger(
                                            'handleDoneClick - Editor updated successfully via global context'
                                        );
                                    } else {
                                        // 폴백: DOM에서 에디터 찾기
                                        const editorElement =
                                            document.querySelector('[data-editor-instance]');
                                        if (
                                            editorElement &&
                                            (editorElement as any)._blockNoteEditor
                                        ) {
                                            const editor = (editorElement as any)._blockNoteEditor;
                                            uploaderLogger(
                                                'handleDoneClick - Found editor via DOM fallback, updating directly',
                                                {
                                                    editorType:
                                                        editor?.constructor?.name || 'unknown',
                                                }
                                            );

                                            // HTML을 BlockNote 블록으로 변환하여 에디터 업데이트
                                            const blocks = await editor.tryParseHTMLToBlocks(body);
                                            editor.replaceBlocks(editor.document, blocks);
                                            uploaderLogger(
                                                'handleDoneClick - Editor updated successfully via DOM fallback'
                                            );
                                        } else {
                                            uploaderLogger(
                                                'handleDoneClick - No editor found in global context or DOM, but DB already updated'
                                            );
                                        }
                                    }
                                } catch (error) {
                                    uploaderLogger(
                                        'handleDoneClick - Error updating editor, but DB already updated',
                                        { error }
                                    );
                                }
                            } else {
                                uploaderLogger(
                                    'handleDoneClick - Page ID mismatch, editor update skipped (DB already updated)'
                                );
                            }

                            setIsTitleLoading(false);

                            // 상태 업데이트 통합
                            uploaderLogger('handleDoneClick - Caption: Updating application state');
                            // 캡션 생성 후 목록 갱신을 즉시+1초 후 실행 (외과수술적 업데이트)
                            refreshList({
                                source: 'components/home/logined/fileUploader:handleDoneClick-Caption',
                                pageId: result.id,
                                action: 'create',
                            });
                            runSync({});
                            updateCurrentPageContent({
                                id: result.id,
                                title,
                                body,
                            });
                        })
                        .catch((error) => {
                            setIsTitleLoading(false);

                            if (error instanceof Error && error.name === 'AbortError') {
                                uploaderLogger('handleDoneClick - Caption fetching aborted');
                                return;
                            }

                            uploaderLogger('handleDoneClick - Error fetching caption', { error });
                            runSync({});
                            openSnackbar({
                                message: t`제목을 자동으로 생성할 수 없습니다. 제목을 입력해 주세요.`,
                            });
                        });
                } else {
                    uploaderLogger('handleDoneClick - Non-image file for logged-in user, syncing');
                    runSync({});
                }
            })
            .catch((error) => {
                uploaderLogger('handleDoneClick - Error creating content', { error });
                console.error('File uploader error:', error);
                openSnackbar({
                    message: t`콘텐츠 생성에 실패했습니다.`,
                });
            });

        uploaderLogger('handleDoneClick - Cleanup and closing uploader');
        uploaderRef.current?.getAPI().removeAllFiles();
        uploadedFilesRef.current = [];
        openFileUploader({ open: false });
        // 에디터 컨텍스트 초기화
        setEditorContext({
            editor: null,
            mode: null,
        });
        uploaderLogger('handleDoneClick - End');
    };

    const handleModalClose = () => {
        uploaderLogger('handleModalClose', {
            filesCount: uploadedFilesRef.current.length,
            hasAbortController: !!abortControllerRef.current,
        });
        openFileUploader({ open: false });
    };

    // 하이드레이션 되기 전 렌더링 방지
    if (!isHydrated) return null;

    const meta: Record<string, string> = {};

    if (pageId) {
        uploaderLogger('FileUploader - Adding pageId to metadata', { pageId });
        meta['pageId'] = pageId;
    }

    if (userId) {
        uploaderLogger('FileUploader - Adding userId to metadata', { userId });
        meta['userId'] = userId;
    }

    uploaderLogger('FileUploader - Checking public key');
    if (process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY === undefined) {
        uploaderLogger('FileUploader - Missing UPLOADCARE_PUBLIC_KEY environment variable');
        throw new Error(
            'NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY가 존재하지 않습니다. .env.template을 참조해서 .env 파일에 추가해주세요.'
        );
    }

    uploaderLogger('FileUploader - Preparing final render', {
        meta,
        themeMode,
        isDarkMode,
        hasPageId: !!pageId,
        hasUserId: !!userId,
        hasPublicKey: !!process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY,
    });

    return (
        <div id="file_uploader">
            <FileUploaderRegular
                ctxName="fileUploaderCtx"
                apiRef={uploaderRef}
                pubkey={process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY}
                onCommonUploadSuccess={handleUploadFinish}
                onFileUrlChanged={handleFileUrlChanged}
                onDoneClick={handleDoneClick}
                onModalClose={handleModalClose}
                sourceList="local, camera"
                image-shrink={IMAGE_SHRINK_POLICY_STRING}
                metadata={meta}
                enableAudioRecording={true}
                maxVideoRecordingDuration={10}
                cameraModes="photo,video"
                classNameUploader={isDarkMode ? 'uc-dark' : 'uc-light'}
            ></FileUploaderRegular>
        </div>
    );
});
