/**
 * @jest-environment node
 *
 * UsageService.get() 유닛 테스트
 *
 * Issue #1094: 결제 시스템 단위 테스트 커버리지 개선 - Phase 3
 *
 * 이 테스트는 UsageService의 get 메서드가 올바르게 동작하는지 검증합니다.
 * get은 사용자의 사용량 정보를 조회하는 메서드입니다.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UsageService } from '../usageService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database/types';

// Supabase 클라이언트 모킹
const createMockSupabaseClient = () => {
    return {
        from: jest.fn(),
    } as unknown as SupabaseClient<Database>;
};

// Mock Usage Data
const createMockUsageData = (userId: string, overrides = {}) => ({
    user_id: userId,
    plan_type: 'FREE',
    current_quota: 0.5,
    status: 'ACTIVE',
    store: null,
    last_reset_date: '2025-10-01T00:00:00Z',
    next_reset_date: '2025-11-01T00:00:00Z',
    premium_expires_date: null,
    premium_grace_period_expires_date: null,
    premium_product_identifier: null,
    premium_purchase_date: null,
    premium_product_plan_identifier: null,
    data: null,
    is_subscription_canceled: false,
    is_subscription_paused: false,
    management_url: null,
    last_transaction_id: null,
    ...overrides,
});

describe('UsageService.get()', () => {
    let mockSupabase: SupabaseClient<Database>;
    let usageService: UsageService;
    const testUserId = 'test-user-id-123';

    beforeEach(() => {
        mockSupabase = createMockSupabaseClient();
        usageService = new UsageService(mockSupabase);
        jest.clearAllMocks();
    });

    describe('정상 케이스', () => {
        it('사용자의 사용량 정보를 성공적으로 가져와야 한다', async () => {
            // Given
            const mockUsageData = createMockUsageData(testUserId);
            const mockFrom = mockSupabase.from as jest.Mock;
            const mockSelect = jest.fn();
            const mockEq = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    data: [mockUsageData],
                    error: null,
                })
            );

            mockSelect.mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ select: mockSelect });

            // When
            const result = await usageService.get(testUserId);

            // Then
            expect(result).toEqual(mockUsageData);
            expect(mockFrom).toHaveBeenCalledWith('usage');
            expect(mockSelect).toHaveBeenCalledWith('*');
            expect(mockEq).toHaveBeenCalledWith('user_id', testUserId);
        });

        it('FREE 플랜 사용자의 정보를 가져와야 한다', async () => {
            // Given
            const mockUsageData = createMockUsageData(testUserId, {
                plan_type: 'FREE',
                current_quota: 0.3,
            });

            const mockFrom = mockSupabase.from as jest.Mock;
            const mockSelect = jest.fn();
            const mockEq = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    data: [mockUsageData],
                    error: null,
                })
            );

            mockSelect.mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ select: mockSelect });

            // When
            const result = await usageService.get(testUserId);

            // Then
            expect(result.plan_type).toBe('FREE');
            expect(result.current_quota).toBe(0.3);
        });

        it('MONTHLY 플랜 사용자의 정보를 가져와야 한다', async () => {
            // Given
            const mockUsageData = createMockUsageData(testUserId, {
                plan_type: 'MONTHLY',
                store: 'stripe',
                current_quota: 5.5,
                premium_product_identifier: 'web_1_monthly',
            });

            const mockFrom = mockSupabase.from as jest.Mock;
            const mockSelect = jest.fn();
            const mockEq = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    data: [mockUsageData],
                    error: null,
                })
            );

            mockSelect.mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ select: mockSelect });

            // When
            const result = await usageService.get(testUserId);

            // Then
            expect(result.plan_type).toBe('MONTHLY');
            expect(result.store).toBe('stripe');
            expect(result.current_quota).toBe(5.5);
        });
    });

    describe('에러 케이스', () => {
        it('DB 조회 실패 시 에러를 던져야 한다', async () => {
            // Given
            const dbError = new Error('Database connection failed');
            const mockFrom = mockSupabase.from as jest.Mock;
            const mockSelect = jest.fn();
            const mockEq = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    data: null,
                    error: dbError,
                })
            );

            mockSelect.mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ select: mockSelect });

            // When & Then
            await expect(usageService.get(testUserId)).rejects.toThrow(
                'currentUsage 정보를 가져오는데 실패했습니다.'
            );
        });

        it('사용자 데이터가 없으면 에러를 던져야 한다', async () => {
            // Given: 빈 배열 반환
            const mockFrom = mockSupabase.from as jest.Mock;
            const mockSelect = jest.fn();
            const mockEq = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    data: [],
                    error: null,
                })
            );

            mockSelect.mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ select: mockSelect });

            // When & Then
            await expect(usageService.get(testUserId)).rejects.toThrow(
                'currentUsage 정보를 찾을 수 없습니다.'
            );
        });

        it('data가 null이면 에러를 던져야 한다', async () => {
            // Given
            const mockFrom = mockSupabase.from as jest.Mock;
            const mockSelect = jest.fn();
            const mockEq = jest.fn().mockImplementation(() =>
                Promise.resolve({
                    data: null,
                    error: null,
                })
            );

            mockSelect.mockReturnValue({ eq: mockEq });
            mockFrom.mockReturnValue({ select: mockSelect });

            // When & Then
            await expect(usageService.get(testUserId)).rejects.toThrow(
                'currentUsage 정보를 찾을 수 없습니다.'
            );
        });
    });
});
