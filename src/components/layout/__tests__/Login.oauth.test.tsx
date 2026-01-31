/**
 * @jest-environment node
 */

/**
 * OAuth 로그인 queryParams 테스트
 *
 * 이 테스트는 signInWithOAuth 호출 시 올바른 옵션이 전달되는지 검증합니다.
 * Login.tsx 컴포넌트를 직접 렌더링하지 않고, 예상되는 호출 패턴을 검증합니다.
 */

describe('OAuth 로그인 queryParams 검증', () => {
    // signInWithOAuth 호출 시 사용되는 옵션 구조 정의
    interface OAuthOptions {
        provider: 'google' | 'github' | 'apple';
        options: {
            redirectTo: string;
            queryParams?: { prompt?: string };
        };
    }

    // Login.tsx에서 사용하는 OAuth 옵션 생성 함수를 시뮬레이션
    function createOAuthOptions(
        provider: 'google' | 'github' | 'apple',
        redirectTo: string
    ): OAuthOptions {
        return {
            provider,
            options: {
                redirectTo,
                queryParams: { prompt: 'select_account' },
            },
        };
    }

    describe('계정 선택 옵션 (prompt: select_account)', () => {
        test('Google OAuth 옵션에 prompt: select_account가 포함되어야 함', () => {
            const options = createOAuthOptions('google', 'http://localhost:3000/auth/callback');

            expect(options.provider).toBe('google');
            expect(options.options.queryParams).toBeDefined();
            expect(options.options.queryParams?.prompt).toBe('select_account');
        });

        test('GitHub OAuth 옵션에 prompt: select_account가 포함되어야 함', () => {
            const options = createOAuthOptions('github', 'http://localhost:3000/auth/callback');

            expect(options.provider).toBe('github');
            expect(options.options.queryParams).toBeDefined();
            expect(options.options.queryParams?.prompt).toBe('select_account');
        });

        test('Apple OAuth 옵션에 prompt: select_account가 포함되어야 함', () => {
            const options = createOAuthOptions('apple', 'http://localhost:3000/auth/callback');

            expect(options.provider).toBe('apple');
            expect(options.options.queryParams).toBeDefined();
            expect(options.options.queryParams?.prompt).toBe('select_account');
        });
    });

    describe('redirectTo 옵션 포함 확인', () => {
        test('모든 OAuth 옵션에 redirectTo가 포함되어야 함', () => {
            const redirectUrl = 'http://localhost:3000/auth/callback?redirect=/home';

            const googleOptions = createOAuthOptions('google', redirectUrl);
            const githubOptions = createOAuthOptions('github', redirectUrl);
            const appleOptions = createOAuthOptions('apple', redirectUrl);

            expect(googleOptions.options.redirectTo).toBe(redirectUrl);
            expect(githubOptions.options.redirectTo).toBe(redirectUrl);
            expect(appleOptions.options.redirectTo).toBe(redirectUrl);
        });
    });

    describe('Login.tsx 코드 패턴 검증', () => {
        // Login.tsx 파일의 실제 코드 패턴을 정규식으로 검증
        const fs = require('fs');
        const path = require('path');
        const loginFilePath = path.join(__dirname, '..', 'Login.tsx');
        const loginFileContent = fs.readFileSync(loginFilePath, 'utf-8');

        test('Google signInWithOAuth에 queryParams: { prompt: select_account }가 있어야 함', () => {
            // Google OAuth 코드 블록 찾기
            const googlePattern =
                /provider:\s*['"]google['"][\s\S]*?queryParams:\s*\{\s*prompt:\s*['"]select_account['"]\s*\}/;
            expect(loginFileContent).toMatch(googlePattern);
        });

        test('GitHub signInWithOAuth에 queryParams: { prompt: select_account }가 있어야 함', () => {
            const githubPattern =
                /provider:\s*['"]github['"][\s\S]*?queryParams:\s*\{\s*prompt:\s*['"]select_account['"]\s*\}/;
            expect(loginFileContent).toMatch(githubPattern);
        });

        test('Apple signInWithOAuth에 queryParams: { prompt: select_account }가 있어야 함', () => {
            const applePattern =
                /provider:\s*['"]apple['"][\s\S]*?queryParams:\s*\{\s*prompt:\s*['"]select_account['"]\s*\}/;
            expect(loginFileContent).toMatch(applePattern);
        });
    });
});
