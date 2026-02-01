// RelatedPosts.tsx
import React, { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Database } from '@/lib/database/types';
import { createClient } from '@/supabase/utils/client';
import RelatedItem from './RelatedItem';
import { useLingui } from '@lingui/react/macro';
import { editorViewLogger } from '@/debug/editor';

type RelatedPostsProps = {
    currentPageId: string | null;
    sperator?: boolean;
};

type RAGDocumentType = Database['public']['Functions']['match_documents']['Returns'];

const RelatedPosts = memo(function RelatedPosts({
    currentPageId,
    sperator = true,
}: RelatedPostsProps) {
    const { t } = useLingui();
    const [isRelatedVisible, setIsRelatedVisible] = useState(false);
    const [filteredRelated, setFilteredRelated] = useState<RAGDocumentType>([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const relatedRef = useRef<HTMLDivElement | null>(null);

    // 번역 텍스트 메모이제이션
    const relatedContentTitle = useMemo(() => t`관련글`, [t]);

    // 관련 콘텐츠 fetch 함수를 메모이제이션
    const fetchRelatedContent = useCallback(async () => {
        if (currentPageId === null) return [];
        const supabase = createClient();
        try {
            const { data: document, error } = await supabase
                .from('documents')
                .select('embedding')
                .eq('page_id', currentPageId)
                .limit(1);
            editorViewLogger('문서 임베딩 조회', { document });
            if (document && document.length > 0) {
                const embeding = document[0].embedding;
                if (embeding) {
                    const related = await supabase.rpc('match_documents', {
                        query_embedding: embeding,
                        match_threshold: 0.4,
                        match_count: 3,
                    });
                    editorViewLogger('관련 문서 조회 완료', { related });
                    if (related.data) {
                        return related.data;
                    }
                }
            }
        } catch (error) {
            editorViewLogger('관련 문서 조회 오류', { error });
            console.error(error);
        }
        return [];
    }, [currentPageId]);

    // IntersectionObserver 콜백을 메모이제이션
    const handleIntersection = useCallback(
        async ([entry]: IntersectionObserverEntry[]) => {
            if (entry.isIntersecting && !hasLoaded) {
                editorViewLogger('관련 문서 로드 시작 (화면에 표시됨)', { currentPageId });
                setIsRelatedVisible(true);

                const relatedData = await fetchRelatedContent();
                const uniques = Array.from(
                    relatedData
                        .reduce((map, item) => {
                            if (!map.has(item.page_id)) {
                                map.set(item.page_id, item);
                            }
                            return map;
                        }, new Map())
                        .values()
                );
                // 자기 자신은 배제
                const excludeSelf = uniques.filter((item) => item.page_id !== currentPageId);
                setFilteredRelated(excludeSelf);
                setHasLoaded(true);
                editorViewLogger('관련 문서 로드 완료', { count: excludeSelf.length });
            }
        },
        [hasLoaded, currentPageId, fetchRelatedContent]
    );

    // 디버깅용 로그 - 컴포넌트 마운트 시 1회만 실행
    useEffect(
        function logComponentMount() {
            editorViewLogger('RelatedPosts 컴포넌트 마운트', {
                currentPageId,
                hasLoaded,
            });
        },
        [currentPageId, hasLoaded]
    );

    // 페이지 ID가 변경되면 상태 초기화
    useEffect(
        function resetStateOnPageChange() {
            if (currentPageId) {
                setHasLoaded(false);
                setFilteredRelated([]);
                setIsRelatedVisible(false);
            }
        },
        [currentPageId]
    );

    // IntersectionObserver를 사용한 지연 로딩 - 1회만 실행
    useEffect(
        function setupIntersectionObserver() {
            if (hasLoaded || relatedRef.current === null) return;

            const observer = new IntersectionObserver(handleIntersection, { threshold: 0.1 });
            const currentRef = relatedRef.current;

            observer.observe(currentRef);

            return () => {
                if (currentRef) {
                    observer.unobserve(currentRef);
                }
            };
        },
        [hasLoaded, handleIntersection]
    );

    // 렌더링할 관련 아이템들을 메모이제이션
    const renderedItems = useMemo(
        () =>
            filteredRelated.map((document) => (
                <RelatedItem key={document.id} document={document} />
            )),
        [filteredRelated]
    );

    return (
        <>
            <div ref={relatedRef} />
            {isRelatedVisible && filteredRelated.length > 0 && (
                <div
                    className={`my-3 py-3 border-[rgba(0,0,0,0.2)] dark:border-[rgba(255,255,255,0.2)] px-[26px] animate-fade-in max-w-[622px] ${sperator && 'border-t-[1px]'}`}
                >
                    <h2 className="first-letter:mt-3 mb-[5px] inline-block rounded-[18px] bg-text-color px-2 py-1 text-[10px] focus-bg-color opacity-70 tracking-[0.040rem]">
                        {relatedContentTitle}
                    </h2>
                    <ul className="dark:text-[#7e7e7e] my-0">{renderedItems}</ul>
                </div>
            )}
        </>
    );
});

export default RelatedPosts;
