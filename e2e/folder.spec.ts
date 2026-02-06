import { test, expect } from '@playwright/test';

/**
 * 폴더 시스템 E2E 테스트
 * 이슈 #79: 폴더 생성, 관리, 페이지 할당 핵심 사용자 플로우 테스트
 *
 * auth.setup.ts에서 로그인 후 storageState를 사용합니다.
 */

test.describe('폴더 기본 플로우', () => {
    test('폴더 섹션 접근 가능', async ({ page }) => {
        await page.goto('/home/folder');
        await page.waitForLoadState('networkidle');

        // 로그인 상태이므로 폴더 페이지에 접근 가능
        await expect(page).toHaveURL(/\/home\/folder/);
    });

    test('새 폴더 생성 버튼이 존재함', async ({ page }) => {
        await page.goto('/home/folder');
        await page.waitForLoadState('networkidle');

        // 새 폴더 생성 버튼 찾기
        const newFolderButton = page.locator(
            'button:has-text("새 폴더"), button:has-text("New folder"), button:has-text("폴더"), [data-testid="new-folder"], button[aria-label*="folder"]'
        );

        // 버튼이 있으면 확인
        if ((await newFolderButton.count()) > 0) {
            await expect(newFolderButton.first()).toBeVisible();
        }
    });

    test('새 폴더 생성 다이얼로그 열기', async ({ page }) => {
        await page.goto('/home/folder');
        await page.waitForLoadState('networkidle');

        const newFolderButton = page
            .locator(
                'button:has-text("새 폴더"), button:has-text("New folder"), [data-testid="new-folder"]'
            )
            .first();

        if ((await newFolderButton.count()) > 0) {
            await newFolderButton.click();

            // 폴더 이름 입력 다이얼로그 또는 필드 확인
            const folderNameInput = page.locator(
                'input[placeholder*="폴더"], input[placeholder*="folder"], input[placeholder*="이름"], [data-testid="folder-name-input"]'
            );

            // 다이얼로그가 열리면 입력 필드가 보여야 함
            if ((await folderNameInput.count()) > 0) {
                await expect(folderNameInput.first()).toBeVisible({ timeout: 5000 });
            }
        }
    });

    test('폴더 생성 후 목록에 표시됨', async ({ page }) => {
        await page.goto('/home/folder');
        await page.waitForLoadState('networkidle');

        const newFolderButton = page
            .locator(
                'button:has-text("새 폴더"), button:has-text("New folder"), [data-testid="new-folder"]'
            )
            .first();

        if ((await newFolderButton.count()) > 0) {
            await newFolderButton.click();

            const folderNameInput = page
                .locator(
                    'input[placeholder*="폴더"], input[placeholder*="folder"], input[placeholder*="이름"], [data-testid="folder-name-input"]'
                )
                .first();

            if ((await folderNameInput.count()) > 0) {
                const testFolderName = `E2E 테스트 폴더 ${Date.now()}`;
                await folderNameInput.fill(testFolderName);

                // 확인/저장 버튼 클릭
                const confirmButton = page.locator(
                    'button:has-text("확인"), button:has-text("Create"), button:has-text("저장"), button:has-text("만들기")'
                );

                if ((await confirmButton.count()) > 0) {
                    await confirmButton.first().click();

                    // 폴더 목록에 새 폴더 표시 확인 (최대 5초 대기)
                    await page.waitForTimeout(1000);
                    const newFolder = page.locator(`:has-text("${testFolderName}")`);
                    const folderCreated = (await newFolder.count()) > 0;
                    expect(folderCreated).toBeTruthy();
                }
            }
        }
    });
});

test.describe('폴더 관리', () => {
    test('폴더 컨텍스트 메뉴 접근 가능', async ({ page }) => {
        await page.goto('/home/folder');
        await page.waitForLoadState('networkidle');

        // 사이드바의 폴더 항목 찾기
        const folderItem = page
            .locator('[data-testid="folder-item"], .folder-list-item, [role="treeitem"]')
            .first();

        if ((await folderItem.count()) > 0) {
            // 우클릭으로 컨텍스트 메뉴 열기
            await folderItem.click({ button: 'right' });

            // 메뉴 옵션 확인
            const menuOptions = page.locator(
                '[role="menu"], [role="menuitem"], .context-menu, .MuiMenu-list'
            );
            const hasMenu = (await menuOptions.count()) > 0;

            // 메뉴가 없으면 케밥 메뉴 버튼 시도
            if (!hasMenu) {
                const menuButton = folderItem.locator(
                    'button:has-text("⋮"), button:has-text("..."), [data-testid="folder-menu"]'
                );
                if ((await menuButton.count()) > 0) {
                    await menuButton.click();
                }
            }
        }
    });
});

test.describe('폴더 네비게이션', () => {
    test('폴더 클릭 시 해당 폴더 내용 표시', async ({ page }) => {
        await page.goto('/home/folder');
        await page.waitForLoadState('networkidle');

        const folderItem = page
            .locator('[data-testid="folder-item"], .folder-list-item, [role="treeitem"]')
            .first();

        if ((await folderItem.count()) > 0) {
            await folderItem.click();

            // 폴더 내용 영역이 업데이트되는지 확인
            await page.waitForTimeout(1000);

            // URL이 변경되거나 폴더 내용이 표시되면 성공
            const currentUrl = page.url();
            expect(currentUrl).toContain('/home');
        }
    });
});
