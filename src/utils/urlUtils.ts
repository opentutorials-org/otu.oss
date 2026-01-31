/**
 * URL 관련 유틸리티 함수들
 */

/**
 * URL에서 검색어를 추출하는 유틸리티 함수
 *
 * 지원하는 URL 형식:
 * - 경로 기반: /home/search/:keyword, /search/:keyword
 * - 쿼리 기반: ?searchKeyword=xxx (fallback)
 *
 * @returns 검색어 또는 null
 */
export function getSearchKeywordFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const url = new URL(window.location.href);
        // 우선 경로 기반(/home/search/:keyword 또는 /search/:keyword)을 파싱
        const pathParts = url.pathname.split('/');
        const searchIndex = pathParts.findIndex((p) => p === 'search');
        if (searchIndex >= 0 && pathParts.length > searchIndex + 1) {
            const key = decodeURIComponent(pathParts[searchIndex + 1]);
            if (key && key !== ':keyword') return key;
        }
        // fallback: querystring
        const keyword = url.searchParams.get('searchKeyword');
        return keyword;
    } catch {
        return null;
    }
}
