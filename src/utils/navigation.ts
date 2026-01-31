import { getDefaultStore } from 'jotai';
import { currentPageState, currentPageType } from '@/lib/jotai';
import { navPageLogger } from '@/debug/nav';

const store = getDefaultStore();

// navigateWithState에 의한 변경을 감지하기 위한 플래그
let isNavigatingWithState = false;

/**
 * 브라우저 히스토리와 currentPage 상태를 동시에 업데이트하여 빠른 페이지 전환을 제공
 * router.push보다 빠르게 동작하며, Next.js 라우팅을 우회합니다.
 * @deprecated
 */
export function navigateWithState(url: string, pageState: currentPageType) {
    navPageLogger('called:', { url, pageState });

    // 플래그 설정: watchingPathChange에서 이 변경을 무시하도록 함
    isNavigatingWithState = true;
    navPageLogger('flag set to true');

    // currentPage 상태 업데이트 (path도 URL과 일치하도록 설정)
    const updatedPageState = { ...pageState, path: url };
    store.set(currentPageState, updatedPageState);

    navPageLogger('State updated. New state:', store.get(currentPageState));

    // 브라우저 히스토리 업데이트 (즉시 실행)
    history.pushState(null, '', url);

    // 다음 tick에서 플래그 리셋
    setTimeout(() => {
        isNavigatingWithState = false;
        navPageLogger('flag reset to false');
    }, 10);
}

/**
 * navigateWithState에 의한 변경인지 확인하는 함수
 * @deprecated
 */
export function isCurrentlyNavigating() {
    return isNavigatingWithState;
}

/**
 * 홈 페이지로의 빠른 네비게이션
 * @deprecated
 */
export function navigateToHome() {
    navigateWithState('/home', {
        type: 'HOME',
        id: null,
        path: '/',
    });
}

/**
 * 검색 페이지로의 빠른 네비게이션
 * @deprecated
 */
export function navigateToSearch(keyword?: string) {
    navPageLogger('navigateToSearch called:', { keyword });

    const url =
        keyword && keyword.trim().length > 0
            ? `/home/search/${encodeURIComponent(keyword.trim())}`
            : '/home/search';
    const searchId = keyword?.trim() || null;

    const pageState = {
        type: 'SEARCH' as const,
        id: searchId,
        path: url,
    };

    navPageLogger('navigateToSearch: setting state:', pageState);

    navigateWithState(url, pageState);
}

/**
 * 페이지 생성으로의 빠른 네비게이션
 * @deprecated
 */
export function navigateToPageCreate(id: string) {
    navigateWithState(`/home/page/${id}`, {
        type: 'PAGE_CREATE',
        id: id,
        path: `/home/page/${id}`,
    });
}

/**
 * 페이지 편집으로의 빠른 네비게이션 (URL 기반)
 * @deprecated
 */
export function navigateToPageEdit(id: string, searchKeyword?: string) {
    navPageLogger('navigateToPageEdit called:', { id, searchKeyword });

    // 검색 컨텍스트가 있으면 검색 경로 안에서 상세로 이동
    let url = `/home/page/${id}`;
    if (searchKeyword && searchKeyword.trim().length > 0) {
        url = `/home/search/${encodeURIComponent(searchKeyword.trim())}/${id}`;
    }
    const pageState = {
        type: 'PAGE_EDIT' as const,
        id: id,
        path: url,
    };

    navPageLogger('Setting page state with URL-based approach:', pageState);

    navigateWithState(url, pageState);
}

/**
 * 폴더 보기로 네비게이션 (URL 기반)
 * @deprecated
 */
export function navigateToFolderList() {
    navPageLogger('navigateToFolderList called:');

    // searchKeyword가 있으면 URL에 query parameter로 추가
    let url = `/home/folder`;
    const pageState = {
        type: 'FOLDER_LIST' as const,
        id: null,
        path: url,
    };

    navigateWithState(url, pageState);
}

/**
 * 폴더 상세로의 빠른 네비게이션
 * @deprecated
 */
export function navigateToFolderDetail(id: string, returnTo?: string) {
    let url = `/home/folder/${id}`;
    if (returnTo) {
        url += `?return=${encodeURIComponent(returnTo)}`;
    }
    const pageState = {
        type: 'FOLDER' as const,
        id: id,
        path: url,
    };
    navigateWithState(url, pageState);
}

/**
 * 리마인더 페이지로의 빠른 네비게이션
 * @deprecated
 */
export function navigateToReminder() {
    navPageLogger('navigateToReminder called');

    const url = '/home/reminder';
    const pageState = {
        type: 'HOME' as const,
        id: null,
        path: url,
    };

    navigateWithState(url, pageState);
}

/**
 * URL에서 검색어를 추출하는 유틸리티 함수
 * @deprecated
 */
export function getSearchKeywordFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const url = new URL(window.location.href);
        // 우선 경로 기반(/home/search/:keyword)을 파싱
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
