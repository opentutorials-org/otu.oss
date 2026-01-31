import { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { get } from '@/watermelondb/control/Page';
import { editorIndexLogger } from '@/debug/editor';
import { updateCurrentPageContentState, syncCompletedRefreshState } from '@/lib/jotai';
import { useAtomValue } from 'jotai';
import { content } from '@/types';

/**
 * 페이지 데이터 로드를 담당하는 훅
 * EditorContent의 데이터 로드 로직 추출
 */
export function usePageData(pageId: string) {
    const [content, setContent] = useState<content | null>(null);
    const [mode, setMode] = useState<null | 'create' | 'update'>(null);
    const [isLoading, setIsLoading] = useState(true);
    const updatePageContent = useSetAtom(updateCurrentPageContentState);
    const syncRefreshSeed = useAtomValue(syncCompletedRefreshState);
    const previousPageIdRef = useRef<string | null>(null);

    const handleCurrentPageChange = useCallback(() => {
        editorIndexLogger('usePageData - pageId 변경 감지', { pageId, syncRefreshSeed });
        let isActive = true;

        if (!pageId) {
            editorIndexLogger('pageId가 null이므로 상태 초기화 후 종료');
            setContent(null);
            setMode(null);
            setIsLoading(false);
            return () => {
                isActive = false;
            };
        }

        if (previousPageIdRef.current !== pageId) {
            editorIndexLogger('새로운 pageId 감지 - 상태 초기화');
            previousPageIdRef.current = pageId;
            setMode(null);
            setContent(null);
        }

        (async () => {
            setIsLoading(true);
            editorIndexLogger('데이터 로딩 시작');

            try {
                const data = await get(pageId);

                if (!isActive) {
                    editorIndexLogger('비동기 로딩이 취소되어 상태 업데이트를 건너뜀');
                    return;
                }

                // data가 null인지 확인
                if (!data) {
                    throw new Error('데이터를 불러올 수 없습니다');
                }

                setContent({
                    id: data.id,
                    // @ts-ignore
                    title: data.title,
                    // @ts-ignore
                    body: data.body,
                    // @ts-ignore
                    is_public: data.is_public,
                    // @ts-ignore
                    length: data.length,
                    // @ts-ignore
                    img_url: data.img_url,
                    // @ts-ignore
                    created_at: data.createdAt,
                });

                // 브라우저 타이틀 업데이트를 위해 currentPageContentState 업데이트
                updatePageContent({
                    id: data.id,
                    // @ts-ignore
                    title: data.title,
                    // @ts-ignore
                    body: data.body,
                });

                setMode('update');
                editorIndexLogger('페이지 데이터 설정 - update 모드', { pageData: data });
            } catch (e) {
                if (!isActive) {
                    editorIndexLogger('비동기 로딩 실패 처리도 취소됨');
                    return;
                }
                // create mode
                setContent({
                    id: pageId,
                    title: '',
                    body: '',
                    is_public: false,
                    // @ts-ignore
                    length: 0,
                    // @ts-ignore
                    img_url: '',
                });

                // 브라우저 타이틀 초기화 (새 페이지 생성 시)
                updatePageContent({
                    id: null,
                    title: null,
                    body: null,
                });

                setMode('create');
                editorIndexLogger('페이지 데이터 설정 - create 모드', { id: pageId });
            } finally {
                if (isActive) {
                    setIsLoading(false);
                    editorIndexLogger('데이터 로딩 완료');
                }
            }
        })();

        return () => {
            editorIndexLogger('usePageData cleanup - 비동기 작업 취소');
            isActive = false;
        };
    }, [pageId, syncRefreshSeed, updatePageContent]);

    useEffect(handleCurrentPageChange, [handleCurrentPageChange]);

    return {
        content,
        mode,
        setMode,
        isLoading,
    };
}
