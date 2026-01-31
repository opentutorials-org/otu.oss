import { useEffect, useRef } from 'react';
import { enhancedRenderLogger } from '@/debug/render';

interface UseCustomInfiniteScrollOptions {
    hasNextPage: boolean;
    loading: boolean;
    onLoadMore: () => void;
    disabled?: boolean;
    rootMargin?: string;
    threshold?: number;
}

interface UseCustomInfiniteScrollReturn {
    sentryRef: React.RefObject<HTMLDivElement | null>;
}

export function useCustomInfiniteScroll({
    hasNextPage,
    loading,
    onLoadMore,
    disabled = false,
    rootMargin = '100px',
    threshold = 0.1,
}: UseCustomInfiniteScrollOptions): UseCustomInfiniteScrollReturn {
    const sentryRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const sentryElement = sentryRef.current;
        if (!sentryElement || !hasNextPage || loading || disabled) {
            return;
        }

        enhancedRenderLogger('Intersection Observer 설정', {
            hasNextPage,
            loading,
            disabled,
            rootMargin,
            threshold,
        });

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                enhancedRenderLogger('Intersection Observer 콜백', {
                    isIntersecting: entry.isIntersecting,
                    intersectionRatio: entry.intersectionRatio,
                    hasNextPage,
                    loading,
                });

                if (entry.isIntersecting && hasNextPage && !loading && !disabled) {
                    enhancedRenderLogger('센트리가 뷰포트에 들어왔음 - loadMore 호출');
                    onLoadMore();
                }
            },
            {
                rootMargin,
                threshold,
            }
        );

        observer.observe(sentryElement);

        return () => {
            enhancedRenderLogger('Intersection Observer 정리');
            observer.disconnect();
        };
    }, [hasNextPage, loading, disabled, onLoadMore, rootMargin, threshold]);

    return { sentryRef };
}
