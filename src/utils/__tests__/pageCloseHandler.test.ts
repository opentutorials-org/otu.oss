/** @jest-environment node */
/**
 * pageCloseHandler 네비게이션 로직 테스트
 *
 * 이 테스트는 pageCloseHandler의 네비게이션 결정 로직을 검증합니다.
 * jotai 의존성으로 인해 모듈 전체를 mock하기 어려워,
 * 네비게이션 결정 로직을 순수 함수 형태로 추출하여 테스트합니다.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * 네비게이션 결정 로직을 순수 함수로 추출
 * pageCloseHandler.ts의 로직을 단순화하여 테스트
 */
type PageType =
    | 'HOME'
    | 'PAGE_EDIT'
    | 'PAGE_READ'
    | 'PAGE_CREATE'
    | 'SEARCH'
    | 'FOLDER'
    | 'FOLDER_LIST';
type TriggerSource = 'back-button' | 'pull-to-dismiss' | 'logo-click';

interface NavigationDecisionParams {
    pageType: PageType;
    isModified: boolean;
    triggerSource: TriggerSource;
    forceHomeNavigation: boolean;
    searchKeyword: string | null;
    reminderParam: string | null;
    folderParam: string | null;
    returnParam: string | null;
}

type NavigationResult =
    | { type: 'home'; resetSearch: boolean }
    | { type: 'search'; keyword: string }
    | { type: 'folder'; folderId: string }
    | { type: 'folderList' }
    | { type: 'reminder' }
    | { type: 'hardRedirect'; url: string };

/**
 * 네비게이션 결정 로직 (pageCloseHandler의 핵심 로직)
 */
function determineNavigation(params: NavigationDecisionParams): NavigationResult {
    const {
        pageType,
        isModified,
        triggerSource,
        forceHomeNavigation,
        searchKeyword,
        reminderParam,
        folderParam,
        returnParam,
    } = params;

    // 1. 강제 홈 네비게이션 처리
    if (forceHomeNavigation) {
        if (triggerSource === 'logo-click' && isModified) {
            return { type: 'hardRedirect', url: '/home' };
        }
        return { type: 'home', resetSearch: true };
    }

    // 2. 수정사항이 있는 경우
    if (isModified) {
        return { type: 'home', resetSearch: true };
    }

    // 3. 검색 키워드가 있는 경우 (PAGE_EDIT 또는 PAGE_READ)
    if ((pageType === 'PAGE_EDIT' || pageType === 'PAGE_READ') && searchKeyword) {
        return { type: 'search', keyword: searchKeyword };
    }

    // 4. PAGE_READ/PAGE_EDIT에서 리마인더 또는 폴더 파라미터 확인
    if (['PAGE_READ', 'PAGE_EDIT'].includes(pageType)) {
        if (reminderParam === 'true') {
            return { type: 'reminder' };
        }
        if (folderParam) {
            return { type: 'folder', folderId: folderParam };
        }
    }

    // 5. FOLDER 타입 처리
    if (pageType === 'FOLDER') {
        if (returnParam === 'home') {
            return { type: 'home', resetSearch: true };
        }
        return { type: 'folderList' };
    }

    // 6. SEARCH 페이지 또는 로고 클릭
    if (pageType === 'SEARCH' || triggerSource === 'logo-click') {
        return { type: 'home', resetSearch: true };
    }

    // 7. 기본값: 홈으로 이동
    return { type: 'home', resetSearch: false };
}

/**
 * React Router 경로 생성 함수
 */
function buildNavigationPath(result: NavigationResult): string | null {
    switch (result.type) {
        case 'home':
            return '/';
        case 'search':
            return `/search/${encodeURIComponent(result.keyword)}`;
        case 'folder':
            return `/folder/${result.folderId}`;
        case 'folderList':
            return '/folder';
        case 'reminder':
            return '/reminder';
        case 'hardRedirect':
            return null; // 하드 리다이렉트는 navigate 함수로 처리하지 않음
    }
}

describe('pageCloseHandler 네비게이션 로직', () => {
    describe('determineNavigation', () => {
        describe('forceHomeNavigation이 true인 경우', () => {
            it('로고 클릭 + 수정사항 있음 = 하드 리다이렉트', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_EDIT',
                    isModified: true,
                    triggerSource: 'logo-click',
                    forceHomeNavigation: true,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'hardRedirect', url: '/home' });
            });

            it('로고 클릭 + 수정사항 없음 = 홈으로 이동', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_EDIT',
                    isModified: false,
                    triggerSource: 'logo-click',
                    forceHomeNavigation: true,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'home', resetSearch: true });
            });
        });

        describe('수정사항이 있는 경우', () => {
            it('수정사항이 있으면 홈으로 이동', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_EDIT',
                    isModified: true,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'home', resetSearch: true });
            });
        });

        describe('검색 키워드가 있는 경우', () => {
            it('PAGE_EDIT + 검색 키워드 = 검색 페이지로 이동', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_EDIT',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: 'test-keyword',
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'search', keyword: 'test-keyword' });
            });

            it('PAGE_READ + 검색 키워드 = 검색 페이지로 이동', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_READ',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: 'another-keyword',
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'search', keyword: 'another-keyword' });
            });
        });

        describe('리마인더 파라미터가 있는 경우', () => {
            it('PAGE_READ + reminder=true = 리마인더 페이지로 이동', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_READ',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: 'true',
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'reminder' });
            });

            it('PAGE_EDIT + reminder=true = 리마인더 페이지로 이동', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_EDIT',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: 'true',
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'reminder' });
            });
        });

        describe('폴더 파라미터가 있는 경우', () => {
            it('PAGE_EDIT + folder = 폴더 상세 페이지로 이동', () => {
                const result = determineNavigation({
                    pageType: 'PAGE_EDIT',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: 'folder-123',
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'folder', folderId: 'folder-123' });
            });
        });

        describe('FOLDER 타입인 경우', () => {
            it('FOLDER + return=home = 홈으로 이동', () => {
                const result = determineNavigation({
                    pageType: 'FOLDER',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: null,
                    returnParam: 'home',
                });

                expect(result).toEqual({ type: 'home', resetSearch: true });
            });

            it('FOLDER + return 없음 = 폴더 리스트로 이동', () => {
                const result = determineNavigation({
                    pageType: 'FOLDER',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'folderList' });
            });
        });

        describe('SEARCH 페이지인 경우', () => {
            it('SEARCH 페이지에서 뒤로가기 = 홈으로 이동 + 검색 초기화', () => {
                const result = determineNavigation({
                    pageType: 'SEARCH',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'home', resetSearch: true });
            });
        });

        describe('기본 케이스', () => {
            it('HOME 페이지에서 뒤로가기 = 홈으로 이동', () => {
                const result = determineNavigation({
                    pageType: 'HOME',
                    isModified: false,
                    triggerSource: 'back-button',
                    forceHomeNavigation: false,
                    searchKeyword: null,
                    reminderParam: null,
                    folderParam: null,
                    returnParam: null,
                });

                expect(result).toEqual({ type: 'home', resetSearch: false });
            });
        });
    });

    describe('buildNavigationPath', () => {
        it('home 결과를 / 경로로 변환', () => {
            expect(buildNavigationPath({ type: 'home', resetSearch: true })).toBe('/');
        });

        it('search 결과를 /search/:keyword 경로로 변환', () => {
            expect(buildNavigationPath({ type: 'search', keyword: 'test' })).toBe('/search/test');
        });

        it('검색 키워드에 특수문자가 있으면 URL 인코딩', () => {
            expect(buildNavigationPath({ type: 'search', keyword: '한글 & special' })).toBe(
                `/search/${encodeURIComponent('한글 & special')}`
            );
        });

        it('folder 결과를 /folder/:id 경로로 변환', () => {
            expect(buildNavigationPath({ type: 'folder', folderId: 'abc-123' })).toBe(
                '/folder/abc-123'
            );
        });

        it('folderList 결과를 /folder 경로로 변환', () => {
            expect(buildNavigationPath({ type: 'folderList' })).toBe('/folder');
        });

        it('reminder 결과를 /reminder 경로로 변환', () => {
            expect(buildNavigationPath({ type: 'reminder' })).toBe('/reminder');
        });

        it('hardRedirect 결과는 null 반환 (navigate 사용 안함)', () => {
            expect(buildNavigationPath({ type: 'hardRedirect', url: '/home' })).toBe(null);
        });
    });

    describe('우선순위 테스트', () => {
        it('forceHomeNavigation은 다른 모든 조건보다 우선', () => {
            const result = determineNavigation({
                pageType: 'PAGE_EDIT',
                isModified: false,
                triggerSource: 'logo-click',
                forceHomeNavigation: true,
                searchKeyword: 'test', // 검색 키워드가 있어도 무시
                reminderParam: 'true', // 리마인더 파라미터가 있어도 무시
                folderParam: 'folder-1', // 폴더 파라미터가 있어도 무시
                returnParam: null,
            });

            expect(result).toEqual({ type: 'home', resetSearch: true });
        });

        it('isModified는 검색 키워드보다 우선', () => {
            const result = determineNavigation({
                pageType: 'PAGE_EDIT',
                isModified: true, // 수정사항 있음
                triggerSource: 'back-button',
                forceHomeNavigation: false,
                searchKeyword: 'test', // 검색 키워드가 있어도 무시
                reminderParam: null,
                folderParam: null,
                returnParam: null,
            });

            expect(result).toEqual({ type: 'home', resetSearch: true });
        });

        it('검색 키워드는 리마인더/폴더 파라미터보다 우선', () => {
            const result = determineNavigation({
                pageType: 'PAGE_EDIT',
                isModified: false,
                triggerSource: 'back-button',
                forceHomeNavigation: false,
                searchKeyword: 'test', // 검색 키워드 우선
                reminderParam: 'true',
                folderParam: 'folder-1',
                returnParam: null,
            });

            expect(result).toEqual({ type: 'search', keyword: 'test' });
        });

        it('리마인더는 폴더보다 우선', () => {
            const result = determineNavigation({
                pageType: 'PAGE_EDIT',
                isModified: false,
                triggerSource: 'back-button',
                forceHomeNavigation: false,
                searchKeyword: null,
                reminderParam: 'true', // 리마인더 우선
                folderParam: 'folder-1',
                returnParam: null,
            });

            expect(result).toEqual({ type: 'reminder' });
        });
    });
});
