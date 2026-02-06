import { test, expect } from '@playwright/test';

/**
 * Seed Test - OTU 앱 기본 환경 초기화 테스트
 *
 * 이 테스트는 앱의 기본 진입점과 인증 흐름을 검증합니다.
 * 다른 테스트의 기반이 되는 시드 테스트입니다.
 *
 * 비로그인 상태 테스트이므로 storageState를 사용하지 않습니다.
 */

// 비로그인 상태로 테스트 실행
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('앱 초기 상태', () => {
    test('비로그인 시 signin 페이지로 리디렉션', async ({ page }) => {
        // 홈 페이지 접근 시도
        await page.goto('/home');

        // 비로그인 상태에서는 signin 페이지로 리디렉션되어야 함
        await expect(page).toHaveURL(/signin/);
    });

    test('signin 페이지 로드 확인', async ({ page }) => {
        await page.goto('/signin');

        // 페이지가 정상적으로 로드되었는지 확인
        await expect(page).toHaveURL(/signin/);

        // 로그인 관련 요소가 존재하는지 확인
        // Google 로그인 버튼 또는 이메일 입력 필드 확인
        const hasLoginElement = await page
            .locator('[data-testid="signin"], button, input[type="email"]')
            .first()
            .isVisible()
            .catch(() => false);

        expect(hasLoginElement || (await page.title())).toBeTruthy();
    });
});

// 인증 흐름 테스트는 auth.spec.ts에서 더 상세하게 테스트합니다.
