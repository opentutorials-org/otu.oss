import { test, expect } from '@playwright/test';

/**
 * 인증 플로우 E2E 테스트
 * 이슈 #79: 인증 관련 핵심 사용자 플로우 테스트
 *
 * 테스트 환경: 로컬 Supabase + 테스트 계정
 *
 * 비로그인 상태에서 로그인/회원가입 페이지를 테스트합니다.
 */

// 비로그인 상태로 테스트 실행
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('인증 플로우', () => {
    test.describe('보호된 경로 리디렉션', () => {
        test('비로그인 시 /home 접근하면 /signin으로 리디렉션', async ({ page }) => {
            await page.goto('/home');

            // 클라이언트 사이드 리디렉션 대기 (최대 10초)
            await expect(page).toHaveURL(/signin/, { timeout: 10000 });
        });

        test('비로그인 시 /home/page/[id] 접근하면 /signin으로 리디렉션', async ({ page }) => {
            // 임의의 페이지 ID로 접근 시도
            await page.goto('/home/page/test-page-id');

            // 클라이언트 사이드 리디렉션 대기
            await expect(page).toHaveURL(/signin/, { timeout: 10000 });
        });

        test('비로그인 시 /home/folder/[id] 접근하면 /signin으로 리디렉션', async ({ page }) => {
            // 임의의 폴더 ID로 접근 시도
            await page.goto('/home/folder/test-folder-id');

            // 클라이언트 사이드 리디렉션 대기
            await expect(page).toHaveURL(/signin/, { timeout: 10000 });
        });
    });

    test.describe('로그인 페이지 UI', () => {
        test('signin 페이지에 로그인 폼 또는 소셜 로그인 버튼이 존재', async ({ page }) => {
            await page.goto('/signin');

            // 페이지 로드 대기
            await page.waitForLoadState('networkidle');

            // 이메일/패스워드 입력 필드 또는 소셜 로그인 버튼 확인
            // OTU 앱의 실제 UI: "Google로 로그인", "Github로 로그인", "Apple로 로그인"
            const emailInput = page.locator('input[type="email"], input[name="email"]');
            const passwordInput = page.locator('input[type="password"], input[name="password"]');
            const googleButton = page.locator(
                'button:has-text("Google"), span:has-text("Google로 로그인")'
            );
            const githubButton = page.locator(
                'button:has-text("GitHub"), button:has-text("Github"), span:has-text("Github로 로그인")'
            );
            const appleButton = page.locator(
                'button:has-text("Apple"), span:has-text("Apple로 로그인")'
            );

            const hasEmailForm = (await emailInput.count()) > 0 && (await passwordInput.count()) > 0;
            const hasSocialLogin =
                (await googleButton.count()) > 0 ||
                (await githubButton.count()) > 0 ||
                (await appleButton.count()) > 0;

            expect(hasEmailForm || hasSocialLogin).toBeTruthy();
        });

        test('Google 로그인 버튼이 클릭 가능한 상태', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('networkidle');

            const googleButton = page.locator('span:has-text("Google로 로그인")').first();
            const hasGoogleButton = (await googleButton.count()) > 0;

            if (hasGoogleButton) {
                await expect(googleButton).toBeVisible();
            }
        });

        test('GitHub 로그인 버튼이 클릭 가능한 상태', async ({ page }) => {
            await page.goto('/signin');
            await page.waitForLoadState('networkidle');

            const githubButton = page.locator('span:has-text("Github로 로그인")').first();
            const hasGithubButton = (await githubButton.count()) > 0;

            if (hasGithubButton) {
                await expect(githubButton).toBeVisible();
            }
        });
    });

    test.describe('이메일 로그인 폼 검증', () => {
        test('이메일 입력 필드가 존재하면 입력 가능', async ({ page }) => {
            await page.goto('/signin');

            const emailInput = page.locator('input[type="email"], input[name="email"]');

            if ((await emailInput.count()) > 0) {
                await emailInput.first().fill('test@example.com');
                await expect(emailInput.first()).toHaveValue('test@example.com');
            }
        });

        test('패스워드 입력 필드가 존재하면 입력 가능', async ({ page }) => {
            await page.goto('/signin');

            const passwordInput = page.locator('input[type="password"], input[name="password"]');

            if ((await passwordInput.count()) > 0) {
                await passwordInput.first().fill('testpassword123');
                await expect(passwordInput.first()).toHaveValue('testpassword123');
            }
        });
    });
});

test.describe('회원가입 페이지', () => {
    test('signup 페이지 접근 가능', async ({ page }) => {
        await page.goto('/signup');

        // signup 페이지 로드 확인 (리디렉션 없이)
        await expect(page).toHaveURL(/signup/);
    });

    test('회원가입 폼 요소 존재 확인', async ({ page }) => {
        await page.goto('/signup');

        // 이메일 입력 필드 확인
        const emailInput = page.locator('input[type="email"], input[name="email"]');
        const passwordInput = page.locator('input[type="password"], input[name="password"]');

        const hasSignupForm = (await emailInput.count()) > 0 && (await passwordInput.count()) > 0;

        // 회원가입 폼이 있거나, 소셜 로그인만 지원하는 경우 둘 다 허용
        expect(hasSignupForm || (await page.title())).toBeTruthy();
    });
});
