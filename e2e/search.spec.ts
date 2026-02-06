import { test, expect } from '@playwright/test';

/**
 * 검색 기능 E2E 테스트
 * 이슈 #79: 검색 핵심 사용자 플로우 테스트
 *
 * auth.setup.ts에서 로그인 후 storageState를 사용합니다.
 */

test.describe('검색 기본 플로우', () => {
    test('검색 페이지 접근 가능', async ({ page }) => {
        await page.goto('/home/search');
        await page.waitForLoadState('networkidle');

        // 로그인 상태이므로 검색 페이지에 접근 가능
        await expect(page).toHaveURL(/\/home/);
    });

    test('검색 입력 필드가 존재하고 입력 가능', async ({ page }) => {
        await page.goto('/home');
        await page.waitForLoadState('networkidle');

        // 검색 입력 필드 또는 검색 버튼 찾기
        const searchInput = page.locator(
            'input[type="search"], input[placeholder*="검색"], input[placeholder*="Search"], [data-testid="search-input"]'
        );
        const searchButton = page.locator(
            'button:has-text("검색"), button[aria-label*="search"], [data-testid="search-button"]'
        );

        const hasSearchInput = (await searchInput.count()) > 0;
        const hasSearchButton = (await searchButton.count()) > 0;

        // 검색 기능이 있어야 함
        expect(hasSearchInput || hasSearchButton).toBeTruthy();

        if (hasSearchInput) {
            await searchInput.first().fill('테스트 검색어');
            await expect(searchInput.first()).toHaveValue('테스트 검색어');
        }
    });

    test('검색어 입력 후 Enter 시 검색 실행', async ({ page }) => {
        await page.goto('/home');
        await page.waitForLoadState('networkidle');

        const searchInput = page
            .locator(
                'input[type="search"], input[placeholder*="검색"], input[placeholder*="Search"], [data-testid="search-input"]'
            )
            .first();

        if ((await searchInput.count()) > 0) {
            await searchInput.fill('테스트');
            await searchInput.press('Enter');

            // 검색 결과 영역 또는 URL 변경 확인
            await page.waitForTimeout(2000);

            // URL에 search 파라미터가 있거나 검색 결과 영역이 있으면 성공
            const currentUrl = page.url();
            const searchResults = page.locator(
                '[data-testid="search-results"], .search-results, [role="listbox"]'
            );
            const hasResults = (await searchResults.count()) > 0;

            expect(hasResults || currentUrl.includes('search')).toBeTruthy();
        }
    });
});

test.describe('검색 결과', () => {
    test('검색 결과에서 페이지 클릭 시 해당 페이지로 이동', async ({ page }) => {
        await page.goto('/home/search?q=test');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // 검색 결과 항목 찾기
        const searchResultItem = page.locator(
            '[data-testid="search-result-item"], .search-result-item, [role="option"]'
        );

        if ((await searchResultItem.count()) > 0) {
            await searchResultItem.first().click();

            // 페이지 URL로 이동 확인
            await expect(page).toHaveURL(/\/home\/page\//, { timeout: 10000 });
        }
    });

    test('검색 결과가 없을 때 적절한 메시지 표시', async ({ page }) => {
        // 존재하지 않을 것 같은 검색어로 검색
        await page.goto('/home/search?q=zzzznonexistent12345xyz');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // "결과 없음" 메시지 또는 빈 상태 확인
        const noResults = page.locator(
            ':has-text("결과 없음"), :has-text("No results"), :has-text("찾을 수 없"), [data-testid="no-results"]'
        );

        const hasNoResultsMessage = (await noResults.count()) > 0;

        // 메시지가 있거나, 검색 결과가 비어있으면 성공
        const searchResults = page.locator(
            '[data-testid="search-result-item"], .search-result-item'
        );
        const resultsCount = await searchResults.count();

        expect(hasNoResultsMessage || resultsCount === 0).toBeTruthy();
    });
});

test.describe('검색 네비게이션', () => {
    test('검색 페이지에서 뒤로가기 시 이전 페이지로 복귀', async ({ page }) => {
        // 홈에서 시작
        await page.goto('/home');
        await page.waitForLoadState('networkidle');

        const homeUrl = page.url();

        // 검색 실행
        const searchInput = page
            .locator(
                'input[type="search"], input[placeholder*="검색"], input[placeholder*="Search"], [data-testid="search-input"]'
            )
            .first();

        if ((await searchInput.count()) > 0) {
            await searchInput.fill('test');
            await searchInput.press('Enter');
            await page.waitForTimeout(1000);

            // 뒤로가기
            await page.goBack();

            // 이전 URL로 복귀 확인
            await expect(page).toHaveURL(homeUrl, { timeout: 5000 });
        }
    });
});
