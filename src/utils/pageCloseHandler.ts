import { currentPageType } from '@/lib/jotai';
import { getSearchKeywordFromUrl } from '@/utils/urlUtils';
import {
    navigateToFolderDetail as legacyNavigateToFolderDetail,
    navigateToFolderList as legacyNavigateToFolderList,
    navigateToHome as legacyNavigateToHome,
    navigateToSearch as legacyNavigateToSearch,
    navigateToReminder as legacyNavigateToReminder,
} from '@/utils/navigation';
import { editorAutoSaveLogger } from '@/debug/editor';

/**
 * React Router navigate 함수 타입
 */
export type NavigateFunction = (path: string) => void;

export interface PageCloseOptions {
    currentPage: currentPageType;
    isModified: boolean;
    resetSearch: () => void;
    triggerSource: 'back-button' | 'pull-to-dismiss' | 'logo-click';
    forceHomeNavigation?: boolean; // 로고 클릭처럼 강제로 홈으로 이동하는 경우
    setIsModified?: (value: boolean) => void; // 뒤로가기에서만 사용
    navigate?: NavigateFunction; // React Router navigate 함수 (없으면 레거시 함수 사용)
}

/**
 * 네비게이션 헬퍼 함수들
 * navigate 파라미터가 있으면 React Router 사용, 없으면 레거시 함수 fallback
 */
function navigateToHome(navigate?: NavigateFunction): void {
    if (navigate) {
        navigate('/');
    } else {
        legacyNavigateToHome();
    }
}

function navigateToSearch(keyword: string, navigate?: NavigateFunction): void {
    if (navigate) {
        navigate(`/search/${encodeURIComponent(keyword)}`);
    } else {
        legacyNavigateToSearch(keyword);
    }
}

function navigateToFolderDetail(folderId: string, navigate?: NavigateFunction): void {
    if (navigate) {
        navigate(`/folder/${folderId}`);
    } else {
        legacyNavigateToFolderDetail(folderId);
    }
}

function navigateToFolderList(navigate?: NavigateFunction): void {
    if (navigate) {
        navigate('/folder');
    } else {
        legacyNavigateToFolderList();
    }
}

function navigateToReminder(navigate?: NavigateFunction): void {
    if (navigate) {
        navigate('/reminder');
    } else {
        legacyNavigateToReminder();
    }
}

/**
 * 페이지 닫기 시 공통 처리 로직
 * - 자동저장 (수정사항이 있는 경우)
 * - 검색 맥락에 따른 적절한 네비게이션
 * - 로깅
 */
export function handlePageClose(options: PageCloseOptions): void {
    const {
        currentPage,
        isModified,
        resetSearch,
        triggerSource,
        forceHomeNavigation = false,
        setIsModified,
        navigate,
    } = options;

    const searchKeywordFromUrl = getSearchKeywordFromUrl();

    // 1. 자동저장 처리 (수정사항이 있는 경우)
    if (isModified) {
        if (typeof window !== 'undefined' && document) {
            const saveButton = document.querySelector(
                '#editor-save-button .MuiButtonBase-root'
            ) as HTMLElement;
            if (saveButton) {
                editorAutoSaveLogger(
                    `Auto-save triggered by ${triggerSource} - save button found and clicked`,
                    {
                        currentPageType: currentPage.type,
                        searchKeyword: searchKeywordFromUrl,
                    }
                );
                saveButton.click();
            } else {
                editorAutoSaveLogger(
                    `Auto-save triggered by ${triggerSource} - save button NOT found`,
                    {
                        currentPageType: currentPage.type,
                        searchKeyword: searchKeywordFromUrl,
                    }
                );
            }
        } else {
            editorAutoSaveLogger(
                `Auto-save skipped - not in browser environment (${triggerSource})`,
                {
                    currentPageType: currentPage.type,
                    searchKeyword: searchKeywordFromUrl,
                }
            );
        }
    }

    // 2. 네비게이션 처리
    if (forceHomeNavigation) {
        // 로고 클릭 등 강제로 홈으로 이동하는 경우
        resetSearch();
        if (triggerSource === 'logo-click' && isModified) {
            location.href = '/home'; // 로고 클릭 시 새로고침
        } else {
            navigateToHome(navigate);
        }
        return;
    }

    if (isModified) {
        // 수정사항이 있는 경우: 검색 상태 초기화하고 홈으로 이동
        resetSearch();
        navigateToHome(navigate);
    } else {
        // 수정사항이 없는 경우: 검색 맥락에 따라 다르게 처리
        if (
            (currentPage.type === 'PAGE_EDIT' || currentPage.type === 'PAGE_READ') &&
            searchKeywordFromUrl
        ) {
            // 검색된 결과에서 상세보기로 들어온 경우 검색 페이지로 돌아가기
            if (setIsModified) {
                setIsModified(false); // 뒤로가기에서만 필요
            }
            navigateToSearch(searchKeywordFromUrl, navigate);
        } else {
            // 일반 상세보기나 다른 페이지의 경우
            if (currentPage.type === 'SEARCH' || triggerSource === 'logo-click') {
                // 검색 페이지에서 로고 클릭하거나 검색 상태 초기화가 필요한 경우
                resetSearch();
            }
            if (['PAGE_READ', 'PAGE_EDIT'].includes(currentPage.type)) {
                // 리마인더에서 온 경우 리마인더 페이지로 이동
                const reminderFromUrl = new URL(window.location.href).searchParams.get('reminder');
                if (reminderFromUrl === 'true') {
                    navigateToReminder(navigate);
                    return;
                }

                // 폴더 ID가 있는 경우 폴더 목록으로 이동
                const folderIdFromUrl = new URL(window.location.href).searchParams.get('folder');
                if (folderIdFromUrl) {
                    navigateToFolderDetail(folderIdFromUrl, navigate);
                    return;
                }
            }
            if (currentPage.type === 'FOLDER') {
                // 폴더 디테일 페이지를 닫는 경우 return 파라미터 확인
                const returnTo = new URL(window.location.href).searchParams.get('return');
                if (returnTo === 'home') {
                    // 홈에서 온 경우 홈으로 돌아가기
                    resetSearch();
                    navigateToHome(navigate);
                } else {
                    // 그 외의 경우 폴더 리스트로 돌아가기
                    navigateToFolderList(navigate);
                }
                return;
            }
            navigateToHome(navigate);
        }
    }
}

/**
 * CreateUpdate 컴포넌트용 페이지 닫기 핸들러
 */
export function createPageCloseHandler(
    currentPage: currentPageType,
    resetSearch: () => void,
    triggerSource: 'pull-to-dismiss' = 'pull-to-dismiss',
    navigate?: NavigateFunction
) {
    return () => {
        // 저장 버튼 자동 클릭 (pull-to-dismiss에서는 다른 selector 사용)
        if (typeof window !== 'undefined' && document) {
            const saveButton = document.querySelector(
                '#editor-save-button .MuiChip-root'
            ) as HTMLElement;
            if (saveButton) {
                editorAutoSaveLogger(
                    `Auto-save triggered by ${triggerSource} - save button found and clicked`,
                    {
                        currentPageType: currentPage.type,
                    }
                );
                saveButton.click();
            } else {
                editorAutoSaveLogger(
                    `Auto-save triggered by ${triggerSource} - save button NOT found`,
                    {
                        currentPageType: currentPage.type,
                    }
                );
            }
        } else {
            editorAutoSaveLogger(
                `Auto-save skipped - not in browser environment (${triggerSource})`,
                {
                    currentPageType: currentPage.type,
                }
            );
        }

        // // 폴더 쿼리 파라미터가 있으면 URL만 변경하고 currentPageState는 건드리지 않음 (애니메이션 방지)
        // if (typeof window !== 'undefined') {
        //   const url = new URL(window.location.href);
        //   const folderId = url.searchParams.get('folder');
        //   const searchKeyword = url.searchParams.get('searchKeyword');

        //   if (folderId) {
        //     // URL만 변경하고 currentPageState는 그대로 유지
        //     let nextUrl = `/home?folder=${folderId}`;
        //     if (searchKeyword) {
        //       nextUrl += `&searchKeyword=${encodeURIComponent(searchKeyword)}`;
        //     }
        //     history.pushState(null, '', nextUrl);
        //     return; // 여기서 종료하여 다른 네비게이션 로직 실행하지 않음
        //   }
        // }

        // 검색 맥락 확인 및 적절한 네비게이션 처리
        const searchKeywordFromUrl = getSearchKeywordFromUrl();
        if (
            (currentPage.type === 'PAGE_EDIT' || currentPage.type === 'PAGE_READ') &&
            searchKeywordFromUrl
        ) {
            // 검색된 결과에서 상세보기로 들어온 경우 검색 페이지로 돌아가기
            navigateToSearch(searchKeywordFromUrl, navigate);
        } else if (currentPage.type === 'FOLDER') {
            // 폴더 디테일 페이지를 닫는 경우 return 파라미터 확인
            const returnTo = new URL(window.location.href).searchParams.get('return');
            if (returnTo === 'home') {
                // 홈에서 온 경우 홈으로 돌아가기
                resetSearch();
                navigateToHome(navigate);
            } else {
                // 그 외의 경우 폴더 리스트로 돌아가기
                navigateToFolderList(navigate);
            }
        } else if (['PAGE_READ', 'PAGE_EDIT'].includes(currentPage.type)) {
            // 리마인더에서 온 경우 리마인더 페이지로 이동
            const reminderFromUrl = new URL(window.location.href).searchParams.get('reminder');
            if (reminderFromUrl === 'true') {
                navigateToReminder(navigate);
                return;
            }

            // 폴더 ID가 있는 경우 폴더 디테일로 이동
            const folderIdFromUrl = new URL(window.location.href).searchParams.get('folder');
            if (folderIdFromUrl) {
                navigateToFolderDetail(folderIdFromUrl, navigate);
                return;
            }
            // 폴더 ID가 없는 경우 홈으로 이동
            resetSearch();
            navigateToHome(navigate);
        } else {
            // 일반 상세보기나 다른 페이지의 경우 홈으로 이동하면서 검색 상태 초기화
            resetSearch();
            navigateToHome(navigate);
        }
    };
}
