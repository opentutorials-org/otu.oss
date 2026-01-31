'use client';

import { Outlet } from 'react-router-dom';
import Container from './Container';
import { enhancedRenderLogger } from '@/debug/render';
import { useCallback, useEffect } from 'react';
import { useNavigation } from '@/hooks/useNavigation';
import { getSearchKeywordFromUrl } from '@/utils/navigation';
import { list } from '@/watermelondb/control/Page';
import TopControls from '@/components/home/shared/TopControls';
import { useSetAtom } from 'jotai';
import { updateCurrentPageContentState, currentPageState } from '@/lib/jotai';

export function PageList() {
    enhancedRenderLogger('PageList');
    const updatePageContent = useSetAtom(updateCurrentPageContentState);
    const setCurrentPage = useSetAtom(currentPageState);

    const { navigateToPageEdit } = useNavigation();

    // 글 목록으로 돌아올 때 페이지 상태 초기화 (브라우저 타이틀 "OTU"만 표시)
    useEffect(() => {
        // 페이지 콘텐츠 초기화
        updatePageContent({
            id: null,
            title: null,
            body: null,
        });

        // 페이지 타입을 PAGE_LIST로 설정
        setCurrentPage({
            type: 'PAGE_LIST',
            id: null,
            path: '/home/page',
        });
    }, [updatePageContent, setCurrentPage]);

    // 기본 페이지 fetcher
    const fetcher = useCallback(
        async (params: {
            rangeStart: number;
            rangeEnd: number;
            sortingKey: string;
            sortCriteria: 'asc' | 'desc';
            keyword?: string | null;
        }) => {
            const typeSafeParams = {
                rangeStart: params.rangeStart,
                rangeEnd: params.rangeEnd,
                sortingKey: params.sortingKey,
                sortCriteria: params.sortCriteria,
                searchKeyword: Array.isArray(params.keyword) ? params.keyword[0] : params.keyword,
            };
            return await list(typeSafeParams);
        },
        []
    );

    // 기본 페이지 선택 핸들러
    const onSelect = useCallback(
        (id: string, type: string) => {
            const searchKeyword = getSearchKeywordFromUrl();
            navigateToPageEdit(id, searchKeyword || undefined);
        },
        [navigateToPageEdit]
    );

    return (
        <div>
            <TopControls />
            <div className="mt-4">
                <Container fetcher={fetcher} onSelect={onSelect} />
            </div>
            <Outlet />
        </div>
    );
}
