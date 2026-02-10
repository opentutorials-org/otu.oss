/** @jest-environment node */
/**
 * fetchUserId 함수 테스트
 * Issue #135: PR #128 후속 - fetchUserId 에러 처리 테스트 커버리지 추가
 *
 * 테스트 대상:
 * - fetchUserId: supabase.auth.getUser() 호출 및 에러 핸들링
 *
 * 모킹 전략:
 * - next/headers의 cookies를 모킹
 * - createServerClient를 통해 supabase.auth.getUser() 결과 제어
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// next/headers cookies 모킹
const mockCookieStore = {
    getAll: jest.fn<any>().mockResolvedValue([]),
    set: jest.fn(),
};

jest.mock('next/headers', () => ({
    cookies: jest.fn(() => mockCookieStore),
}));

// Supabase 클라이언트 모킹
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGetUser: jest.Mock<any>;

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(() => ({
        auth: { getUser: mockGetUser },
    })),
}));

describe('fetchUserId', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetUser = jest.fn();

        // 모킹된 createServerClient를 주입
        const ssrModule = require('@supabase/ssr');
        ssrModule.createServerClient.mockReturnValue({
            auth: { getUser: mockGetUser },
        });
    });

    describe('성공 케이스', () => {
        it('getUser 성공 시 user.id를 반환해야 한다', async () => {
            const expectedUserId = 'test-user-id-12345';
            mockGetUser.mockResolvedValue({
                data: {
                    user: { id: expectedUserId },
                },
                error: null,
            });

            const { fetchUserId } = await import('@/supabase/utils/server');
            const userId = await fetchUserId();

            expect(userId).toBe(expectedUserId);
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });
    });

    describe('에러 케이스', () => {
        it('getUser 에러 시 "Auth error: [message]"를 throw해야 한다', async () => {
            const errorMessage = 'Invalid JWT token';
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: { message: errorMessage },
            });

            const { fetchUserId } = await import('@/supabase/utils/server');

            await expect(fetchUserId()).rejects.toThrow(`Auth error: ${errorMessage}`);
        });

        it('data.user가 null인 경우 "No authenticated user found"를 throw해야 한다', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const { fetchUserId } = await import('@/supabase/utils/server');

            await expect(fetchUserId()).rejects.toThrow('No authenticated user found');
        });

        it('data.user가 undefined인 경우 "No authenticated user found"를 throw해야 한다', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: undefined },
                error: null,
            });

            const { fetchUserId } = await import('@/supabase/utils/server');

            await expect(fetchUserId()).rejects.toThrow('No authenticated user found');
        });
    });

    describe('에지 케이스', () => {
        it('getUser가 예외를 던지면 그대로 전파되어야 한다', async () => {
            const unexpectedError = new Error('Network error');
            mockGetUser.mockRejectedValue(unexpectedError);

            const { fetchUserId } = await import('@/supabase/utils/server');

            await expect(fetchUserId()).rejects.toThrow('Network error');
        });

        it('에러 메시지가 정확히 포맷되어야 한다', async () => {
            const specificError = 'Session expired';
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: { message: specificError },
            });

            const { fetchUserId } = await import('@/supabase/utils/server');

            try {
                await fetchUserId();
                fail('에러가 발생해야 합니다');
            } catch (error: any) {
                expect(error.message).toBe(`Auth error: ${specificError}`);
                expect(error.message).toContain('Auth error:');
                expect(error.message).toContain(specificError);
            }
        });
    });
});
