'use client';
import { displayModeState, searchMethodState } from '@/lib/jotai';
import { useAtom } from 'jotai';
// import useInfiniteScroll from 'react-infinite-scroll-hook'; // 직접 구현으로 대체
import List from '@/components/home2/shared/displayType/List';
import Grid from '@/components/home2/shared/displayType/Grid';
import { enhancedRenderLogger } from '@/debug/render';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useAlarmsStatus } from '@/hooks/useAlarmsStatus';
import { useCustomInfiniteScroll } from '@/hooks/useCustomInfiniteScroll';
import InfiniteScrollSentry from '@/components/common/InfiniteScrollSentry';

type PresentationProps = {
    contents:
        | {
              id: string;
              title: string;
              body: string;
              createdAt: string;
              img_url: string;
              length: number;
              type: string;
              folder_id?: string | null;
          }[]
        | null;
    hasNextPage: boolean;
    onSelect: (id: string, type: string) => void;
    error?: any;
    loadMore: () => void;
};

export default function Presentation({
    contents,
    hasNextPage,
    onSelect,
    error,
    loadMore,
}: PresentationProps) {
    const [displayMode] = useAtom(displayModeState);
    const [searchMethod] = useAtom(searchMethodState);
    const { t } = useLingui();

    // 페이지 ID 목록 추출
    const pageIds = useMemo(() => {
        return contents?.map((content) => content.id) || [];
    }, [contents]);

    // 알람 상태 확인
    const { alarmStatuses } = useAlarmsStatus(pageIds);

    // 커스텀 무한 스크롤 훅 사용
    const { sentryRef } = useCustomInfiniteScroll({
        hasNextPage,
        loading: false, // wmdb 기반 즉시 응답이므로 항상 false
        onLoadMore: loadMore,
        disabled: !!error,
        rootMargin: '100px',
        threshold: 0.1,
    });

    enhancedRenderLogger('PagePresentation rendered', {
        contentsLength: contents?.length || 0,
        hasNextPage,
        displayMode,
        searchMethodSortCriteria: searchMethod.sortCriteria,
    });

    return (
        <div>
            {/* 페이지 목록 표시 */}
            {contents !== null && (
                <div className="relative">
                    {displayMode === 'LIST' ? (
                        <List
                            contents={contents}
                            onSelect={onSelect}
                            hideFolderName={false}
                            alarmStatuses={alarmStatuses}
                        />
                    ) : (
                        <Grid
                            contents={contents}
                            onSelect={onSelect}
                            hideFolderName={false}
                            alarmStatuses={alarmStatuses}
                        />
                    )}
                </div>
            )}

            {/* 재사용 가능한 무한 스크롤 센트리 컴포넌트 */}
            <InfiniteScrollSentry
                sentryRef={sentryRef}
                hasNextPage={hasNextPage}
                loading={false} // wmdb 기반 즉시 응답이므로 항상 false
                onManualLoad={loadMore}
            />

            <div className="h-5"></div>
        </div>
    );
}
