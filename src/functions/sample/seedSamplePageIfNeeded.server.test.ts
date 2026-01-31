/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
    createDeterministicSamplePageId,
    seedSamplePageIfNeeded,
} from '@/functions/sample/seedSamplePageIfNeeded.server';

jest.mock('@/i18n-server', () => ({
    getUserLocale: jest.fn().mockResolvedValue('ko'),
}));

jest.mock('next-intl/server', () => ({
    getTranslations: jest.fn().mockResolvedValue({
        raw: (key: 'title' | 'body') => (key === 'title' ? '샘플 제목' : '<p>본문</p>'),
    }),
}));

describe('createDeterministicSamplePageId', () => {
    test('동일한 사용자에 대해 항상 동일한 ID를 생성한다', () => {
        const first = createDeterministicSamplePageId('user-123');
        const second = createDeterministicSamplePageId('user-123');

        expect(first).toBe(second);
        expect(first).toHaveLength(26);
        expect(first).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
    });

    test('다른 사용자에 대해 서로 다른 ID를 생성한다', () => {
        const first = createDeterministicSamplePageId('user-123');
        const second = createDeterministicSamplePageId('user-456');

        expect(first).not.toBe(second);
    });
});

describe('seedSamplePageIfNeeded', () => {
    test('결정적 ID로 샘플 페이지를 생성한다', async () => {
        const userId = 'user-deterministic';
        const insertCalls: Array<Record<string, unknown>> = [];
        const supabase = createSupabaseStub(insertCalls);

        await seedSamplePageIfNeeded(userId, supabase);

        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0]).toMatchObject({
            id: createDeterministicSamplePageId(userId),
            user_id: userId,
            type: 'text',
            is_public: false,
        });
    });

    test('중복 삽입 에러(23505)를 조용히 무시한다', async () => {
        const userId = 'user-conflict';
        const insertCalls: Array<Record<string, unknown>> = [];
        const supabase = createSupabaseStub(insertCalls, { throwConflictOnSecondCall: true });

        await seedSamplePageIfNeeded(userId, supabase);
        await seedSamplePageIfNeeded(userId, supabase);

        expect(insertCalls).toHaveLength(2);
        const expectedId = createDeterministicSamplePageId(userId);
        expect(insertCalls[0].id).toBe(expectedId);
        expect(insertCalls[1].id).toBe(expectedId);
    });
});

type InsertCall = Record<string, unknown>;

function createSupabaseStub(
    insertCalls: InsertCall[],
    options: { throwConflictOnSecondCall?: boolean } = {}
): SupabaseClient {
    let callCount = 0;

    const single = jest.fn((payload: InsertCall) => {
        callCount += 1;

        if (options.throwConflictOnSecondCall && callCount >= 2) {
            return Promise.resolve({ data: null, error: { code: '23505' } });
        }

        return Promise.resolve({ data: payload, error: null });
    });

    const insert = jest.fn((payload: InsertCall) => {
        insertCalls.push(payload);
        return {
            select: () => ({
                single: () => single(payload),
            }),
        };
    });

    const from = jest.fn(() => ({
        insert,
    }));

    return {
        from,
    } as unknown as SupabaseClient;
}
