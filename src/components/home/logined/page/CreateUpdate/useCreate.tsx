'use client';
import { useTranslations } from 'next-intl';
import {
    currentPageState,
    openConfirmState,
    openSnackbarState,
    runSyncState,
    syncingState,
    noticeHistoryState,
    updateCurrentPageContentState,
    refreshListState,
} from '@/lib/jotai';
import { useAtom, useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { extractBodyInfo } from '../../../../../functions/extractBodyInfo';
import { create, get, update } from '@/watermelondb/control/Page';
const { convert } = require('html-to-text');

import { MAX_TITLE_LENGTH, MAX_BODY_LENGTH, TARGET_SIZE } from '@/functions/constants';
import { drawLogger } from '@/debug/draw';

export type pageDataType = {
    id: string;
    title: string;
    body: string;
    is_public: boolean;
    length: number;
    img_url: string | null;
};

// 공개된 페이지의 캐시를 갱신하는 함수 - 외부에서 사용할 수 있도록 export
export const refreshPublicPageCache = async (pageId: string) => {
    drawLogger(`페이지 ID ${pageId} 캐시 갱신 시작`);

    // 서비스 워커 캐시 삭제
    try {
        const host = window.location.origin;

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            drawLogger(`서비스워커 캐시 삭제 시작`);
            const cacheNames = ['share-pages', 'share-api', 'pages-rsc', 'pages'];

            for (const cacheName of cacheNames) {
                try {
                    const cache = await caches.open(cacheName);
                    const keys = await cache.keys();
                    const shareKeys = keys.filter(
                        (request) =>
                            request.url.includes(`/share/${pageId}`) ||
                            request.url.includes(`/api/share/${pageId}`)
                    );

                    for (const request of shareKeys) {
                        await cache.delete(request);
                        drawLogger(`캐시 삭제 완료: ${request.url} (${cacheName})`);
                    }
                } catch (e) {
                    drawLogger(`캐시 ${cacheName} 삭제 실패: ${e}`);
                    console.warn(`캐시 ${cacheName} 삭제 실패:`, e);
                }
            }
        }

        // Next.js 태그 캐시 무효화
        const revalidateUrl = `${host}/api/share/revalidate?id=${pageId}`;
        drawLogger(`서버 캐시 태그 무효화 요청 ${revalidateUrl}`);

        fetch(revalidateUrl, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
            cache: 'no-store',
        }).catch((e) => {
            drawLogger(`서버 캐시 태그 무효화 요청 실패: ${e}`);
            console.warn('서버 캐시 revalidate 요청 실패:', e);
        });
    } catch (cacheError) {
        drawLogger(`캐시 갱신 중 오류 발생: ${cacheError}`);
        console.warn('캐시 갱신 중 오류 발생:', cacheError);
    }
};

export const useCreate = () => {
    const t = useTranslations('editor');
    const tError = useTranslations('error');
    const tValidation = useTranslations('validation');
    const openSnackbar = useSetAtom(openSnackbarState);
    const refreshList = useSetAtom(refreshListState);
    const router = useRouter();
    const setCurrentPage = useSetAtom(currentPageState);
    const setSyncing = useSetAtom(syncingState);
    const runSync = useSetAtom(runSyncState);
    const openConfirm = useSetAtom(openConfirmState);
    const [noticeHistory, setNoticeHistory] = useAtom(noticeHistoryState);
    const noticeHistoryRef = useRef(noticeHistory);
    const updateCurrentPageContent = useSetAtom(updateCurrentPageContentState);

    // draw 모드에서는 noticeHistory가 예전 값을 참조하는 문제가 있었습니다. 원인을 찾지 못해서 ref로 해결했습니다.
    useEffect(() => {
        noticeHistoryRef.current = noticeHistory;
    }, [noticeHistory]);

    const editSubmitHandler = useCallback(
        async function (
            title: string,
            body: string,
            is_public: boolean,
            id: string,
            type: 'text' | 'draw',
            folder_id?: string | null
        ): Promise<{ data: pageDataType; isPublic: boolean } | undefined> {
            if (isEmpty(title, body)) {
                openSnackbar({ message: t('please-enter-title-or-content') });
                return;
            }

            // 제목 길이 검증
            const titleLength = title.length;
            if (titleLength > MAX_TITLE_LENGTH) {
                openSnackbar({
                    message: tValidation('title-length-exceeded', {
                        maxLength: MAX_TITLE_LENGTH.toLocaleString(),
                        currentLength: titleLength.toLocaleString(),
                    }),
                });
                return;
            }

            // 본문 길이 검증
            const bodyLength = body.length;
            if (bodyLength > MAX_BODY_LENGTH) {
                openSnackbar({
                    message: tValidation('body-length-exceeded', {
                        maxLength: MAX_BODY_LENGTH.toLocaleString(),
                        currentLength: bodyLength.toLocaleString(),
                    }),
                });
                return;
            }

            // 제목+본문 합계 길이 검증
            const totalLength = titleLength + bodyLength;
            if (totalLength > TARGET_SIZE) {
                openSnackbar({
                    message: tValidation('target-size-exceeded', {
                        maxLength: TARGET_SIZE.toLocaleString(),
                        titleLength: titleLength.toLocaleString(),
                        bodyLength: bodyLength.toLocaleString(),
                        totalLength: totalLength.toLocaleString(),
                    }),
                });
                return;
            }

            const { length, img_url } = extractBodyInfo(title, body);
            const pageData = {
                id,
                title,
                body,
                is_public,
                length,
                img_url,
                type,
                folder_id,
            };

            let action: 'create' | 'update' = 'update';
            try {
                // 기존 페이지 상태 확인
                const existingPage = await get(id);

                if (existingPage) {
                    // 기존 페이지가 존재하는 경우 - 수정 모드
                    try {
                        await update(pageData);
                        drawLogger('기존 페이지 업데이트 성공', { id });
                        action = 'update';
                    } catch (updateError) {
                        // 에러 타입에 따라 다르게 처리
                        const errorMessage =
                            updateError instanceof Error
                                ? updateError.message
                                : String(updateError);
                        const isNotFoundError = errorMessage.includes('not found');

                        if (isNotFoundError) {
                            // 다른 탭에서 삭제된 경우
                            drawLogger('기존 페이지 업데이트 실패 - 다른 탭에서 삭제됨', {
                                id,
                                error: updateError,
                            });
                            openConfirm({
                                message: `<div>${t.markup('edit-deleted-page', {
                                    br: () => '<br />',
                                })}</div>`,
                                onYes: async () => {
                                    // localStorage에 백업 저장
                                    try {
                                        const finalTitle = title === '' ? t('untitled') : title;
                                        localStorage.setItem(
                                            'editor_deleted_page_backup',
                                            JSON.stringify({
                                                title: finalTitle,
                                                body,
                                                timestamp: Date.now(),
                                            })
                                        );
                                        setTimeout(() => {
                                            router.push('/home/create/page/');
                                        }, 1000);
                                    } catch (error) {
                                        console.error('백업 저장 실패:', error);
                                    }
                                },
                                onNo: () => {
                                    router.push('/');
                                },
                                yesLabel: t('restore'),
                                noLabel: t('ignore'),
                            });
                        } else {
                            // 예상치 못한 다른 오류 - Sentry로 전송
                            drawLogger('기존 페이지 업데이트 실패 - 예상치 못한 오류', {
                                id,
                                error: updateError,
                            });
                            const { captureException } = await import('@sentry/nextjs');
                            captureException(updateError, {
                                tags: {
                                    operation: 'page_update',
                                    page_id: id,
                                },
                                extra: {
                                    pageData: {
                                        id,
                                        title: title.substring(0, 100), // 제목 일부만 전송
                                        bodyLength: body.length,
                                        is_public,
                                    },
                                },
                            });
                            openSnackbar({ message: tError('an-error-occurred') });
                        }
                        return; // 에러 상황이므로 여기서 종료
                    }
                } else {
                    // 기존 페이지가 없는 경우 - 새 페이지 생성
                    drawLogger('기존 페이지 없음 - 새 페이지 생성', { id });
                    await create(pageData);
                    action = 'create';

                    // 페이지 생성 성공 시 currentPageContentState도 업데이트
                    updateCurrentPageContent({
                        id: pageData.id,
                        title: pageData.title,
                        body: pageData.body,
                    });
                }

                // 캐시 갱신 로직은 제거하고 외부에서 호출하도록 변경
            } catch (initialError) {
                // get() 함수 자체가 실패한 경우 - 새 페이지로 간주하여 생성 시도
                drawLogger('페이지 존재 확인 실패 - 새 페이지로 생성 시도', {
                    id,
                    error: initialError,
                });
                try {
                    await create(pageData);
                    action = 'create';

                    // 페이지 생성 성공 시 currentPageContentState도 업데이트
                    updateCurrentPageContent({
                        id: pageData.id,
                        title: pageData.title,
                        body: pageData.body,
                    });
                } catch (createError) {
                    drawLogger('새 페이지 생성도 실패', { id, error: createError });
                    openSnackbar({ message: tError('an-error-occurred') });
                    return;
                }
            }
            refreshList({
                source: 'components/home/logined/page/CreateUpdate/useCreate',
                pageId: id,
                action,
            });
            // 페이지 생성/수정 후 폴더 정보도 업데이트하기 위해 sync 실행
            const { triggerSync } = await import('@/functions/sync');
            triggerSync('components/home/logined/page/CreateUpdate/useCreate:editSubmitHandler');

            // 페이지 데이터와 함께 is_public 상태도 반환하여 외부에서 캐시 갱신 여부를 결정할 수 있게 함
            return { data: pageData, isPublic: is_public };
        },
        [openSnackbar, noticeHistory, updateCurrentPageContent, refreshList]
    );

    const isNeedTitle = (title: string, body: string) =>
        title === '' && !(body === '' || body === '<br>');
    const isEmpty = (title: string, body: string) =>
        title === '' && (body === '' || body === '<br>');

    return { editSubmitHandler };
};
