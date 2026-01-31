import { Outlet, useParams, useNavigate } from 'react-router-dom';
import Container from '../page/Container';
import { enhancedRenderLogger } from '@/debug/render';
import { useCallback } from 'react';
import { list } from '@/watermelondb/control/Page';
import { searchLogger } from '@/debug/search';
import TopControls from '@/components/home/shared/TopControls';

export function SearchList() {
    enhancedRenderLogger('SearchList');

    const navigate = useNavigate();
    const { keyword } = useParams();
    searchLogger('keyword', { keyword });

    // 검색 페이지 fetcher (경로 파라미터를 단일 진실 소스로 사용)
    const fetcher = useCallback(
        async (params: {
            rangeStart: number;
            rangeEnd: number;
            sortingKey: string;
            sortCriteria: 'asc' | 'desc';
            keyword?: string | null;
        }) => {
            const searchKeyword = typeof keyword === 'string' ? keyword : null;
            if (!searchKeyword) {
                return [];
            }
            const typeSafeParams = {
                rangeStart: params.rangeStart,
                rangeEnd: params.rangeEnd,
                sortingKey: params.sortingKey,
                sortCriteria: params.sortCriteria,
                // 경로에서 가져온 검색어만 사용
                searchKeyword: searchKeyword ?? null,
            } as const;
            searchLogger('typeSafeParams', typeSafeParams);
            return await list(typeSafeParams);
        },
        [keyword]
    );

    // 검색 결과에서 페이지 선택 시 상세로 이동 (경로 기반 컨텍스트 유지)
    const onSelect = useCallback(
        (id: string, _type: string) => {
            navigate(`/search/${keyword}/${id}`);
        },
        [navigate, keyword]
    );

    return (
        <div>
            <TopControls contentTypeSwitcher={false} selection={true} sort={true} listType={true} />
            <div>
                <Container
                    key={typeof keyword === 'string' ? `kw:${keyword}` : 'kw:'}
                    fetcher={fetcher}
                    onSelect={onSelect}
                />
            </div>
            <Outlet />
        </div>
    );
}
