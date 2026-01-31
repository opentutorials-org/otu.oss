'use client';
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { refreshSeedAfterContentUpdate, searchMethodState, type RefreshPayload } from '@/lib/jotai';
import { useAtom, useAtomValue } from 'jotai';
import { useImmer } from 'use-immer';
import { renderLogger } from '@/debug/render';
import { enhancedRenderLogger } from '@/debug/render';
import { loadLogger } from '@/debug/load';
import { requestHapticFeedback } from '@/utils/hapticFeedback';
import { useNavigation } from '@/hooks/useNavigation';
import { get } from '@/watermelondb/control/Page';
import Presentation from './Presentation';

type contentListProps = {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    img_url: string;
    length: number;
    type: string;
    folder_id?: string | null;
}[];

type ContainerProps = {
    fetcher: (params: {
        rangeStart: number;
        rangeEnd: number;
        sortingKey: string;
        sortCriteria: 'asc' | 'desc';
        keyword?: string | null;
    }) => Promise<any[]>;
    onSelect: (id: string, type: string) => void;
};

export default function Container({ fetcher, onSelect }: ContainerProps) {
    renderLogger('components/home2/sections/page/Container.tsx');

    const { navigateToPageEdit } = useNavigation();

    const [contents, setContents] = useImmer<{
        data: contentListProps | null;
    }>({ data: null });

    const pageSize = 60;
    const pageRef = useRef(0);
    const isInitialMountRef = useRef(true);
    const isLoadingRef = useRef(false);
    const [hasNextPage, setHasNextPage] = useState(true);
    const lastUpdateInfo = useAtomValue<RefreshPayload>(refreshSeedAfterContentUpdate);
    const [searchMethod, setSearchMethod] = useAtom(searchMethodState);

    enhancedRenderLogger('PageContainer', {
        contents,
        currentPage: pageRef.current,
        pageSize,
        hasNextPage,
        lastUpdateInfo,
        searchMethod,
    });

    const fetchContents = useCallback(
        async (page: number) => {
            // 이미 로딩 중이면 중복 호출 방지
            if (isLoadingRef.current) {
                loadLogger('fetchContents 중복 호출 방지', { page });
                return;
            }

            isLoadingRef.current = true;
            loadLogger('fetchContents 호출됨', {
                page,
                pageSize,
                currentContentsLength: contents.data?.length || 0,
            });

            loadLogger('fetchContents 실행', { page });

            try {
                let sortCriteria = searchMethod.sortCriteria;
                let sortingKey = searchMethod.sortingKey;

                if (sortingKey === '') {
                    sortingKey = 'created_at';
                }

                const rangeStart = page * pageSize;
                const rangeEnd = rangeStart + pageSize;

                loadLogger('fetchContents pagination', { page, pageSize, rangeStart, rangeEnd });

                let rawData: any[] = [];

                const params = {
                    rangeStart,
                    rangeEnd,
                    sortingKey,
                    sortCriteria,
                    keyword: searchMethod.keyword
                        ? Array.isArray(searchMethod.keyword)
                            ? searchMethod.keyword[0]
                            : searchMethod.keyword
                        : null,
                };

                // 외부에서 주입받은 fetcher 사용
                rawData = await fetcher(params);

                // 데이터 매핑
                const mappedData = rawData.map((item) => ({
                    id: item.id,
                    title: item.title,
                    body: item.body,
                    createdAt: item.createdAt,
                    img_url: item.img_url,
                    length: item.length,
                    type: item.type,
                    folder_id: item.folder_id,
                }));

                loadLogger('DB에서 받은 데이터', {
                    page,
                    pageSize,
                    rangeStart,
                    rangeEnd,
                    rawDataLength: rawData.length,
                    mappedDataLength: mappedData.length,
                    mappedDataIds: mappedData.map((d) => d.id),
                });

                // 데이터 업데이트
                const beforeLength = contents.data?.length || 0;
                setContents((draft) => {
                    if (page === 0) {
                        loadLogger('첫 페이지 - 데이터 교체', {
                            기존데이터길이: draft.data?.length || 0,
                            새데이터길이: mappedData.length,
                        });
                        draft.data = mappedData; // 첫 페이지면 교체
                    } else if (draft.data) {
                        loadLogger('다음 페이지 - 데이터 추가', {
                            기존데이터길이: draft.data.length,
                            추가할데이터길이: mappedData.length,
                            추가할데이터IDs: mappedData.map((d) => d.id),
                        });
                        // 다음 페이지면 데이터 추가
                        draft.data.push(...mappedData);
                        loadLogger('데이터 추가 완료', {
                            최종데이터길이: draft.data.length,
                            최종데이터IDs: draft.data.map((d) => d.id),
                        });
                    } else {
                        loadLogger('초기 데이터 설정', { 데이터길이: mappedData.length });
                        draft.data = mappedData;
                    }
                });
                const afterLength = contents.data?.length || 0;

                // hasNextPage 설정: 반환된 데이터가 pageSize와 같으면 더 있음
                const hasMore = mappedData.length === pageSize;
                setHasNextPage(hasMore);

                loadLogger('hasNextPage 계산', {
                    mappedDataLength: mappedData.length,
                    pageSize,
                    hasMore,
                    계산로직: `${mappedData.length} === ${pageSize} = ${hasMore}`,
                });

                loadLogger('fetchContents 완료', {
                    page,
                    dataLength: mappedData.length,
                    pageSize,
                    hasMore,
                    beforeLength,
                    afterLength,
                });
            } catch (error) {
                loadLogger('fetchContents 오류', error);
                // 에러 발생 시 빈 배열로 처리
                const mappedData: any[] = [];
                setContents((draft) => {
                    if (page === 0) {
                        draft.data = mappedData;
                    }
                });
                setHasNextPage(false);
            } finally {
                isLoadingRef.current = false;
            }
        },
        [searchMethod, fetcher, pageSize]
    );

    // 외과수술적 업데이트 처리
    useEffect(() => {
        if (lastUpdateInfo.seed === 'initial') return;

        const { pageId, pageIds, action } = lastUpdateInfo;

        loadLogger('외과수술적 업데이트 감지', {
            pageId,
            pageIds,
            action,
            seed: lastUpdateInfo.seed,
        });

        // pageId도 pageIds도 없으면 전체 갱신 (이전 방식 호환)
        if (!pageId && !pageIds) {
            loadLogger('pageId/pageIds 없음 - 전체 갱신 실행');
            pageRef.current = 0;
            fetchContents(0);
            return;
        }

        // 다중 업데이트 처리
        const targetIds = pageIds || (pageId ? [pageId] : []);
        const BATCH_UPDATE_THRESHOLD = 10; // 임계값: 10개 이상이면 전체 갱신

        if (targetIds.length >= BATCH_UPDATE_THRESHOLD) {
            loadLogger(
                `업데이트 항목 ${targetIds.length}개 - 임계값(${BATCH_UPDATE_THRESHOLD}) 초과로 전체 갱신 실행`
            );
            pageRef.current = 0;
            fetchContents(0);
            return;
        }

        // 외과수술적 업데이트
        if (action === 'delete') {
            // 삭제: 목록에서 제거
            loadLogger('삭제 액션 - 목록에서 제거', { targetIds });
            setContents((draft) => {
                if (!draft.data) return;
                const beforeLength = draft.data.length;
                draft.data = draft.data.filter((item) => !targetIds.includes(item.id));
                loadLogger('삭제 완료', {
                    beforeLength,
                    afterLength: draft.data.length,
                    removed: beforeLength - draft.data.length,
                });
            });
        } else if (action === 'create' || action === 'update') {
            // 생성 또는 수정: 해당 항목들만 갱신
            loadLogger(`${action} 액션 - WatermelonDB에서 ${targetIds.length}개 조회`, {
                targetIds,
            });

            // 모든 페이지를 병렬로 조회
            Promise.all(targetIds.map((id) => get(id)))
                .then((updatedPages) => {
                    loadLogger('페이지 조회 완료', {
                        조회요청: targetIds.length,
                        조회성공: updatedPages.filter((p) => p).length,
                    });

                    setContents((draft) => {
                        if (!draft.data) {
                            loadLogger('draft.data가 null - 업데이트 취소');
                            return;
                        }

                        for (let idx = 0; idx < updatedPages.length; idx++) {
                            const updatedPage = updatedPages[idx];
                            if (!updatedPage) {
                                loadLogger('업데이트할 페이지를 찾을 수 없음', {
                                    pageId: targetIds[idx],
                                });
                                continue;
                            }

                            // @ts-ignore - WatermelonDB Model 타입 캐스팅
                            const mappedPage = {
                                id: updatedPage.id,
                                // @ts-ignore
                                title: updatedPage.title,
                                // @ts-ignore
                                body: updatedPage.body,
                                // @ts-ignore
                                createdAt: updatedPage.createdAt,
                                // @ts-ignore
                                img_url: updatedPage.img_url,
                                // @ts-ignore
                                length: updatedPage.length,
                                // @ts-ignore
                                type: updatedPage.type,
                                // @ts-ignore
                                folder_id: updatedPage.folder_id,
                            };

                            const index = draft.data.findIndex(
                                (item) => item.id === updatedPage.id
                            );

                            if (index >= 0) {
                                // 기존 항목 업데이트
                                loadLogger('기존 항목 업데이트', { index, pageId: updatedPage.id });
                                draft.data[index] = mappedPage;
                            } else if (action === 'create') {
                                // 새 항목 추가 (맨 앞에)
                                loadLogger('새 항목 맨 앞에 추가', { pageId: updatedPage.id });
                                draft.data.unshift(mappedPage);
                            } else {
                                loadLogger('update 액션이지만 기존 항목을 찾을 수 없음', {
                                    pageId: updatedPage.id,
                                    action,
                                });
                            }
                        }

                        loadLogger('배치 업데이트 완료', {
                            업데이트된항목수: updatedPages.filter((p) => p).length,
                        });
                    });
                })
                .catch((error) => {
                    loadLogger('페이지 조회 실패', { targetIds, error });
                });
        }
    }, [lastUpdateInfo, setContents, fetchContents]);

    // 검색/정렬 변경 시 페이지 리셋
    useEffect(() => {
        loadLogger('검색/정렬 변경 감지 - 페이지 리셋', {
            keyword: searchMethod.keyword,
            sortCriteria: searchMethod.sortCriteria,
            sortingKey: searchMethod.sortingKey,
            lastUpdateSeed: lastUpdateInfo.seed,
            currentPage: pageRef.current,
        });

        pageRef.current = 0;
        setContents({ data: null });
        fetchContents(0);
    }, [searchMethod.keyword, searchMethod.sortCriteria, searchMethod.sortingKey, fetchContents]);

    // 초기 마운트 시 데이터 로드
    useEffect(() => {
        if (isInitialMountRef.current) {
            loadLogger('초기 마운트 - fetchContents 호출', {
                page: pageRef.current,
                pageSize,
            });
            fetchContents(0);
            isInitialMountRef.current = false;
        }
    }, [fetchContents]);

    // 검색결과 개수 표시는 제거되었습니다.

    const handleSelect = useCallback(
        async (id: string, type: string) => {
            onSelect(id, type);
            requestHapticFeedback();
        },
        [onSelect]
    );

    const handleLoadMore = useCallback(() => {
        loadLogger('handleLoadMore 호출됨', {
            hasNextPage,
            isLoading: isLoadingRef.current,
            currentPage: pageRef.current,
            currentContentsLength: contents.data?.length || 0,
        });

        if (!hasNextPage) {
            loadLogger('loadMore 차단: hasNextPage가 false');
            return;
        }

        if (isLoadingRef.current) {
            loadLogger('loadMore 차단: 이미 로딩 중');
            return;
        }

        const nextPage = pageRef.current + 1;
        loadLogger('페이지 증가', {
            from: pageRef.current,
            to: nextPage,
        });

        pageRef.current = nextPage;
        fetchContents(nextPage);
    }, [hasNextPage, fetchContents, contents.data?.length]);

    return (
        <Presentation
            contents={contents.data}
            hasNextPage={hasNextPage}
            onSelect={handleSelect}
            loadMore={handleLoadMore}
        />
    );
}
