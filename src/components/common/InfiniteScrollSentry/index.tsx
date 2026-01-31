import React from 'react';
import { enhancedRenderLogger } from '@/debug/render';

interface InfiniteScrollSentryProps {
    sentryRef: React.RefObject<HTMLDivElement | null>;
    hasNextPage: boolean;
    loading: boolean;
    onManualLoad?: () => void;
    loadingText?: string;
    loadMoreText?: string;
    className?: string;
}

export default function InfiniteScrollSentry({
    sentryRef,
    hasNextPage,
    loading,
    onManualLoad,
    className = 'px-[19px] py-4',
}: InfiniteScrollSentryProps) {
    if (!hasNextPage) {
        return null;
    }

    const handleClick = () => {
        enhancedRenderLogger('센트리 div 클릭됨 - 수동 loadMore 호출');
        if (!loading && onManualLoad) {
            onManualLoad();
        }
    };

    return (
        <div className={className}>
            <div ref={sentryRef} className="h-[50px] w-full" onClick={handleClick}>
                {loading ? (
                    <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-1 w-4 border-b-2"></div>
                    </div>
                ) : (
                    <></>
                )}
            </div>
        </div>
    );
}
