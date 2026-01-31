import { getDefaultStore } from 'jotai';
import { currentPageState, currentPageType } from '@/lib/jotai';
import { navPageLogger } from '@/debug/nav';

const store = getDefaultStore();

/**
 * 브라우저 히스토리와 currentPage 상태를 동시에 업데이트하여 빠른 페이지 전환을 제공
 * router.push보다 빠르게 동작하며, Next.js 라우팅을 우회합니다.
 * @deprecated 이 함수는 레거시 홈(/home) 영역에서만 사용됩니다. home2 마이그레이션 완료 후 제거 예정.
 */
function navigateWithState(url: string, pageState: currentPageType) {
    navPageLogger('called:', { url, pageState });

    // currentPage 상태 업데이트 (path도 URL과 일치하도록 설정)
    const updatedPageState = { ...pageState, path: url };
    store.set(currentPageState, updatedPageState);

    navPageLogger('State updated. New state:', store.get(currentPageState));

    // 브라우저 히스토리 업데이트 (즉시 실행)
    history.pushState(null, '', url);
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
