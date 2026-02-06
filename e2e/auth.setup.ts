import { test as setup, expect } from '@playwright/test';

/**
 * Auth Setup - 인증 상태 초기화
 *
 * 테스트 실행 전 테스트 계정으로 로그인하여 인증 상태를 저장합니다.
 * 다른 테스트에서 이 인증 상태를 재사용합니다.
 *
 * 테스트 계정: test@opentutorials.org / 111111
 */

const authFile = 'playwright/.auth/user.json';

// 테스트 계정 정보
const TEST_USER_EMAIL = 'test@opentutorials.org';
const TEST_USER_PASSWORD = '111111';

setup('authenticate', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/signin');
    await page.waitForLoadState('networkidle');

    // 이메일 입력
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill(TEST_USER_EMAIL);

    // 패스워드 입력
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill(TEST_USER_PASSWORD);

    // 로그인 버튼 클릭 (한국어: "로그인")
    const loginButton = page.locator('button:has-text("로그인")');
    await loginButton.click();

    // 로그인 성공 후 /home으로 리디렉션 대기
    await expect(page).toHaveURL(/\/home/, { timeout: 15000 });

    // 인증 상태 저장
    await page.context().storageState({ path: authFile });
});
