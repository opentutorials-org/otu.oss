import TextareaAutosize from '@mui/material/TextareaAutosize';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { useAtomValue, useSetAtom } from 'jotai';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinkifiedTitle } from './LinkifiedTitle';
import { content, contentType, editorStateType } from '@/types';
import {
    currentPageState,
    isDarkModeAtom,
    isModifiedState,
    openConfirmState,
    currentPageContentState,
    isTitleLoadingState,
    openSnackbarState,
    openFolderManagementDialogState,
    openFolderCreationDialogState,
    refreshSeedAfterContentUpdate,
} from '@/lib/jotai';
import { getPageFolder, type Folder, addPageToFolder, getFolders } from '@/functions/folder';
import { useNavigation } from '@/hooks/useNavigation';
import FolderIcon from '@mui/icons-material/Folder';
import { HeaderAreaDummy, HeaderAreaTemplate } from '../HeaderAreaTemplate';
import { editorViewLogger } from '@/debug/editor';
import Image from 'next/image';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'next/navigation';
import { DeleteButton, ReadButton } from './SharedButtons';
import {
    /*ShareButton,*/ CopyButton,
    ReminderButton,
    PublishButton,
    DeleteButton as EditorDeleteButton,
    FolderButton,
} from '../components/buttons';
import { usePublishFeatures } from '../PublishFeatures';
import { useAlarmFeatures } from '../hooks/useAlarmFeatures';
import { convert } from 'html-to-text';
import { openExternalLink } from '@/utils/openExternalLink';
import { convertBlockNoteToHTML } from '@/components/common/BlockNoteEditor';
import { BlockNoteEditor } from '@blocknote/core';
import s from '../style.module.css';
import { FolderOpenIcon } from '@heroicons/react/24/outline';
import { folderLogger } from '@/debug/folder';
import { update as updatePage, get as getPage } from '@/watermelondb/control/Page';

type HeaderAreaProps = {
    content: content | null;
    onDelete: (type: contentType, id: string) => void;
    openInfo: editorStateType;
    title: string;
    onTitleChange: (title: string) => void;
    onChangeIsModified: (isModified: boolean) => void;
    triggerAutoSave?: () => void;
    editor?: BlockNoteEditor;
    onTitleSync?: (title: string) => void;
};

export const HeaderArea = memo(function HeaderArea({
    content,
    onDelete,
    openInfo,
    title,
    onTitleChange,
    onChangeIsModified,
    triggerAutoSave,
    editor,
    onTitleSync,
}: HeaderAreaProps) {
    const setCurrentPage = useSetAtom(currentPageState);
    const darkMode = useAtomValue(isDarkModeAtom);
    const { t } = useLingui();
    const isModified = useAtomValue(isModifiedState);
    const openConfirm = useSetAtom(openConfirmState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const openFolderDialog = useSetAtom(openFolderManagementDialogState);
    const openFolderCreationDialog = useSetAtom(openFolderCreationDialogState);
    const router = useRouter();
    const { navigateToFolderDetail } = useNavigation();
    const isFirstRef = useRef(true);
    const isTitleLoading = useAtomValue(isTitleLoadingState);
    const [copied, setCopied] = useState(false);

    // 현재 페이지 폴더 상태를 로컬로 관리
    const [currentPageFolder, setCurrentPageFolder] = useState<Folder | null>(null);

    // refreshSeedAfterContentUpdate 구독하여 폴더 정보 갱신
    const refreshSeed = useAtomValue(refreshSeedAfterContentUpdate);

    // 현재 페이지 콘텐츠 상태 구독
    const currentPageContent = useAtomValue(currentPageContentState);

    // 번역 텍스트를 메모이제이션
    const translations = useMemo(
        () => ({
            loading: t`로딩중`,
            title: t`제목`,
            readMode: t`읽기 모드`,
            delete: t`삭제`,
            exit: t`나가기`,
            cancel: t`취소`,
            unsavedChangesWarning: '저장하지 않은 변경사항이 있습니다.<br />나가시겠습니까?',
            // share: t`공유`,
            copy: t`복사`,
            reminder: t`리마인더`,
            reminderOn: t`리마인더 시작`,
            reminderOff: t`리마인더 끄기`,
            copied: t`복사됨`,
            folder: t`폴더 관리`,
        }),
        [t]
    );

    // content에서 body 추출 (알림 기능을 위함)
    const bodyText = useMemo(() => {
        if (!content?.body) return '';
        try {
            return convert(content.body, {
                wordwrap: false,
                preserveNewlines: true,
                selectors: [{ selector: 'a', options: { ignoreHref: true } }],
            });
        } catch (error) {
            console.warn('HTML to text conversion failed:', error);
            return content.body;
        }
    }, [content?.body]);

    // 발행 기능 훅
    const {
        isPublished,
        publishContent,
        unpublishContent,
        handlePublishClick,
        isUpdating: isPublishing,
    } = usePublishFeatures(content || ({} as content), openInfo.mode);

    // 현재 페이지의 폴더 정보 로드 (refreshSeed 변경 시에도 업데이트)
    useEffect(
        function loadPageFolder() {
            if (content?.id) {
                getPageFolder(content.id)
                    .then(setCurrentPageFolder)
                    .catch(() => setCurrentPageFolder(null));
            } else {
                setCurrentPageFolder(null);
            }
        },
        [content?.id, refreshSeed]
    );

    // 알림 기능 훅 (content가 있을 때만)
    const { isAlarmActive, handleAlarmClick } = useAlarmFeatures({
        title: title || '',
        body: bodyText,
        pageId: content?.id || '',
    });

    useEffect(
        function updateIsFirstRef() {
            isFirstRef.current = false;
        },
        [content]
    );

    // 페이지 콘텐츠 상태가 업데이트되면 제목 업데이트
    useEffect(
        function syncTitleFromPageContent() {
            // 빈 문자열이나 공백만 있는 제목은 동기화하지 않음
            const title = currentPageContent.title;
            const hasValidTitle = title && title.trim().length > 0;
            if (content && currentPageContent.id === content.id && hasValidTitle) {
                // onTitleSync가 있으면 그것을 사용 (수정 상태 변경 없음)
                if (onTitleSync) {
                    onTitleSync(title);
                    editorViewLogger('제목 동기화 - onTitleSync 사용', {
                        id: currentPageContent.id,
                        title,
                    });
                } else {
                    // 하위 호환성
                    onTitleChange(title);
                    editorViewLogger('제목 업데이트 - onTitleChange 사용 (구버전 동작)', {
                        id: currentPageContent.id,
                        title,
                    });
                }
            }
        },
        [currentPageContent, content, onTitleChange, onTitleSync]
    );

    const handleTitleChange = useCallback(
        (titleOrEvent: string | React.ChangeEvent<HTMLTextAreaElement>) => {
            // 문자열인 경우 (LinkifiedTitle에서 호출) 또는 이벤트 객체인 경우 처리
            const newTitle =
                typeof titleOrEvent === 'string' ? titleOrEvent : titleOrEvent.target.value;
            onTitleChange(newTitle);
            onChangeIsModified(true);
            editorViewLogger('제목 변경 - onTitleChange 호출됨');
        },
        [onTitleChange, onChangeIsModified, triggerAutoSave]
    );

    // 읽기 모드 버튼 클릭 핸들러를 메모이제이션
    const handleReadModeClick = useCallback(() => {
        if (!content) return;

        if (isModified) {
            openConfirm({
                message: translations.unsavedChangesWarning,
                yesLabel: translations.exit,
                noLabel: translations.cancel,
                onYes: () => {
                    setCurrentPage({
                        type: 'PAGE_READ',
                        id: content.id,
                        path: `/home/page/${content.id}`,
                    });
                    router.push(`/home/page/${content.id}`);
                    editorViewLogger('읽기 모드로 전환 - id:', content.id);
                },
            });
        } else {
            setCurrentPage({
                type: 'PAGE_READ',
                id: content.id,
                path: `/home/page/${content.id}`,
            });
            router.push(`/home/page/${content.id}`);
            editorViewLogger('읽기 모드로 전환 - id:', content.id);
        }
    }, [content, isModified, openConfirm, setCurrentPage, router, translations]);

    // 삭제 버튼 클릭 핸들러를 메모이제이션
    const handleDeleteClick = useCallback(() => {
        if (!content) return;
        onDelete('page', content.id);
        editorViewLogger('페이지 삭제 클릭 - id:', content.id);
    }, [content, onDelete]);

    // 날짜 수정 핸들러
    const handleDateChange = useCallback(
        async (newDate: number) => {
            if (!content) return;

            try {
                // 현재 페이지 데이터 가져오기 (length, img_url 등 포함)
                const page = await getPage(content.id);

                if (!page) {
                    throw new Error(`Page with id ${content.id} not found`);
                }

                // WatermelonDB 업데이트
                await updatePage({
                    id: content.id,
                    title: content.title ?? '',
                    body: content.body ?? '',
                    is_public: content.is_public || false,
                    // @ts-ignore
                    length: page.length || 0,
                    // @ts-ignore
                    img_url: page.img_url || null,
                    created_at: new Date(newDate).toISOString(),
                });

                // 자동 저장 트리거 (동기화를 위해)
                if (triggerAutoSave) {
                    triggerAutoSave();
                }

                openSnackbar({ message: '날짜가 수정되었습니다' });
                editorViewLogger('날짜 수정 완료 - 새 날짜:', new Date(newDate).toISOString());
            } catch (error) {
                console.error('날짜 수정 실패:', error);
                openSnackbar({ message: '날짜 수정에 실패했습니다' });
            }
        },
        [content, triggerAutoSave, openSnackbar]
    );

    // 공유 기능 핸들러
    // const handleShareClick = useCallback(async () => {
    //     if (!content?.id) return;

    //     const shareUrl = `${window.location.origin}/home/page/${content.id}`;

    //     try {
    //         if (navigator.share) {
    //             await navigator.share({
    //                 title: title || 'OTU Page',
    //                 url: shareUrl,
    //             });
    //         } else {
    //             await navigator.clipboard.writeText(shareUrl);
    //             openSnackbar({ message: translations.copied });
    //         }
    //     } catch (error) {
    //         console.warn('Share failed:', error);
    //         // 공유 실패 시 클립보드에 복사
    //         try {
    //             await navigator.clipboard.writeText(shareUrl);
    //             openSnackbar({ message: translations.copied });
    //         } catch (clipboardError) {
    //             console.error('Clipboard copy failed:', clipboardError);
    //         }
    //     }
    // }, [content?.id, title, openSnackbar, translations.copied]);

    // 복사 기능 핸들러
    const handleCopyClick = useCallback(async () => {
        if (!content) return;

        let currentBodyText = bodyText; // 기본값으로 저장된 본문 사용

        // 에디터가 있다면 현재 편집 중인 내용을 가져오기
        if (editor) {
            try {
                const currentBodyHTML = await convertBlockNoteToHTML(editor);
                let convertedText = convert(currentBodyHTML, {
                    wordwrap: false,
                    preserveNewlines: true,
                    selectors: [{ selector: 'a', options: { ignoreHref: true } }],
                });

                // "BlockNote image " 텍스트 제거
                currentBodyText = convertedText.replace(/BlockNote image \[([^\]]+)\]/g, '[$1]');

                editorViewLogger('복사 - 현재 편집 중인 내용 사용', {
                    htmlLength: currentBodyHTML.length,
                    textLength: currentBodyText.length,
                    originalText: convertedText,
                    cleanedText: currentBodyText,
                });
            } catch (error) {
                console.warn('현재 편집 내용 가져오기 실패, 저장된 내용 사용:', error);
                // 에러 발생 시 기존 저장된 내용 사용
            }
        }

        const copyText = `${title || ''}\n\n${currentBodyText}`.trim();

        try {
            await navigator.clipboard.writeText(copyText);
            setCopied(true);
            openSnackbar({ message: translations.copied });

            // 2초 후 copied 상태 리셋
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Copy failed:', error);
        }
    }, [content, title, bodyText, editor, openSnackbar, translations.copied]);

    // 폴더 버튼 클릭 핸들러
    const handleFolderClick = useCallback(async () => {
        if (!content?.id) return;

        try {
            folderLogger('폴더 버튼 클릭');
            const list = await getFolders();

            if (Array.isArray(list) && list.length === 0) {
                folderLogger('폴더 없음 → 생성 다이얼로그 표시');
                openFolderCreationDialog({
                    onSuccess: async (folderId: string) => {
                        folderLogger('폴더 생성 성공 → 페이지 폴더 지정 시작', {
                            pageId: content.id,
                            folderId,
                        });
                        try {
                            await addPageToFolder(content.id!, folderId);
                            folderLogger('페이지 폴더 지정 완료', { pageId: content.id, folderId });
                        } catch (error) {
                            folderLogger('페이지 폴더 지정 실패', { error });
                        }
                    },
                });
                return;
            }
        } catch (error) {
            folderLogger('폴더 목록 조회 실패, 기본 동작으로 폴더 관리 다이얼로그 오픈', { error });
        }

        // 기본: 폴더 관리 다이얼로그 오픈
        openFolderDialog({ currentPageId: content.id });
    }, [content?.id, openFolderDialog, openFolderCreationDialog]);

    // 폴더명 클릭 핸들러
    const handleFolderNameClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            if (!currentPageFolder?.id) return;
            navigateToFolderDetail(currentPageFolder.id);
        },
        [currentPageFolder?.id, navigateToFolderDetail]
    );

    const titleComponent = useMemo(() => {
        return isTitleLoading ? (
            <Image
                src="/icon/redactor-ai-loading.svg"
                height="39"
                width="39"
                alt={translations.loading}
                className={darkMode ? 'invert' : ''}
            />
        ) : (
            <Box>
                {/* 폴더 표시 (폴더가 있는 경우만) */}
                {currentPageFolder && (
                    <button
                        onClick={handleFolderNameClick}
                        className="flex items-center gap-1 text-left p-1 -ml-1 rounded-full hover:bg-[var(--focus-bg-color)] transition-colors cursor-pointer px-2"
                    >
                        <FolderOpenIcon className="w-3 h-3" />
                        <span className="text-[12px]">{currentPageFolder.name}</span>
                    </button>
                )}

                {/* 제목 입력 영역 */}
                <LinkifiedTitle
                    title={title}
                    onTitleChange={handleTitleChange}
                    placeholder={translations.title}
                    autoFocus={openInfo.mode === 'create'}
                />
            </Box>
        );
    }, [
        isTitleLoading,
        darkMode,
        title,
        handleTitleChange,
        translations.loading,
        translations.title,
        currentPageFolder,
        handleFolderNameClick,
        openInfo.mode,
    ]);

    // 모드별 플래그를 메모이제이션
    const isCreateMode = useMemo(() => openInfo.mode === 'create', [openInfo.mode]);

    const actionBtnComponent = useMemo(() => {
        if (!content) return null;

        // 에디터 모드(생성/수정)에서는 확장된 기능 버튼들 표시
        if (openInfo.mode === 'create' || openInfo.mode === 'update') {
            return (
                <div className="flex items-center gap-7 mr-3">
                    {/* <ShareButton
                        onClick={handleShareClick}
                        hideTextOnMobile={true}
                        label={translations.share}
                        disabled={isCreateMode}
                    /> */}

                    <CopyButton
                        onClick={handleCopyClick}
                        copied={copied}
                        hideTextOnMobile={true}
                        label={translations.copy}
                        disabled={isCreateMode}
                    />

                    <PublishButton
                        onClick={handlePublishClick}
                        isPublished={isPublished}
                        hideTextOnMobile={true}
                        disabled={isCreateMode}
                    />

                    {/* 폴더 버튼 */}
                    {!isCreateMode && (
                        <FolderButton
                            onClick={handleFolderClick}
                            hideTextOnMobile={true}
                            label={translations.folder}
                            disabled={isCreateMode}
                        />
                    )}

                    <ReminderButton
                        onClick={handleAlarmClick}
                        isActive={isAlarmActive}
                        hideTextOnMobile={true}
                        onLabel={translations.reminderOff}
                        offLabel={translations.reminderOn}
                        label={translations.reminder}
                        disabled={isCreateMode}
                    />

                    <EditorDeleteButton
                        onClick={handleDeleteClick}
                        hideTextOnMobile={true}
                        label={translations.delete}
                        disabled={isCreateMode}
                    />
                </div>
            );
        }

        // 기본 버튼들 (기존 로직)
        const readModeButton =
            openInfo.mode === 'create' ? null : (
                <ReadButton onClick={handleReadModeClick} label={translations.readMode} />
            );

        const deleteButton =
            openInfo.mode === 'update' ? (
                <EditorDeleteButton
                    onClick={handleDeleteClick}
                    label={translations.delete}
                    hideTextOnMobile={true}
                />
            ) : null;

        return (
            <>
                {readModeButton}
                {deleteButton}
            </>
        );
    }, [
        content,
        openInfo.mode,
        isCreateMode,
        // handleShareClick,
        handleCopyClick,
        handlePublishClick,
        handleFolderClick,
        handleAlarmClick,
        handleDeleteClick,
        handleReadModeClick,
        copied,
        isPublished,
        isAlarmActive,
        translations,
    ]);

    const time = useMemo(
        () => (content?.created_at ? Number(content.created_at) : Date.now()),
        [content]
    );

    if (content === null) return <HeaderAreaDummy />;

    return (
        <HeaderAreaTemplate
            titleComponent={titleComponent}
            time={openInfo.mode === 'create' ? null : time}
            actionBtnComponent={actionBtnComponent}
            onDateChange={openInfo.mode === 'update' ? handleDateChange : undefined}
            canEditDate={openInfo.mode === 'update'}
        />
    );
});
