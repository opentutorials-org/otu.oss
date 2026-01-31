/** @jest-environment node */
/**
 * WatermelonDB 동시 동기화 처리 테스트
 *
 * 이 테스트는 다음을 검증합니다:
 * 1. 동시에 여러 sync() 호출 시 중복 실행 방지 (같은 Promise 공유)
 * 2. WatermelonDB의 "Concurrent synchronization is not allowed" 에러가 발생하지 않음
 * 3. 모든 동기화 요청이 성공적으로 완료됨
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock WatermelonDB
const mockSynchronize = jest.fn();
let synchronizeCallCount = 0;
let activeSyncCount = 0;

jest.mock('@nozbe/watermelondb/sync', () => ({
    synchronize: jest.fn(async (args: any) => {
        synchronizeCallCount++;
        activeSyncCount++;

        // WatermelonDB의 실제 동작 시뮬레이션:
        // 이미 동기화가 진행 중이면 에러 발생
        if (activeSyncCount > 1) {
            activeSyncCount--;
            throw new Error(
                '[Sync] Concurrent synchronization is not allowed. More than one synchronize() call was running at the same time, and the later one was aborted before committing results to local database.'
            );
        }

        // 동기화 시뮬레이션 (100ms 소요)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // pullChanges 실행
        if (args.pullChanges) {
            await args.pullChanges({ lastPulledAt: null, schemaVersion: 1, migration: null });
        }

        // pushChanges 실행
        if (args.pushChanges) {
            await args.pushChanges({ changes: {}, lastPulledAt: Date.now() });
        }

        activeSyncCount--;
        return {};
    }),
}));

// Mock database
jest.mock('./index', () => ({
    database: {
        collections: {
            get: jest.fn(() => ({
                query: jest.fn(() => ({
                    fetchCount: jest.fn<() => Promise<number>>().mockResolvedValue(0),
                })),
            })),
        },
    },
}));

// Mock fetch for API calls
global.fetch = jest.fn((url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/api/sync/pull/all')) {
        return Promise.resolve({
            json: () =>
                Promise.resolve({
                    pages: [],
                    folders: [],
                    alarms: [],
                    created_at: null,
                    lastId: null,
                }),
        });
    }
    if (urlStr.includes('/api/sync/pull')) {
        return Promise.resolve({
            ok: true,
            json: () =>
                Promise.resolve({
                    changes: {
                        page: { created: [], updated: [], deleted: [] },
                        folder: { created: [], updated: [], deleted: [] },
                        alarm: { created: [], updated: [], deleted: [] },
                    },
                    timestamp: Date.now(),
                }),
        });
    }
    if (urlStr.includes('/api/sync/push')) {
        return Promise.resolve({ ok: true });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
}) as any;

describe('WatermelonDB 동시 동기화 처리', () => {
    beforeEach(() => {
        synchronizeCallCount = 0;
        activeSyncCount = 0;
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('단일 sync() 호출은 정상 작동해야 함', async () => {
        const { sync } = require('./sync');

        await expect(sync()).resolves.toBeDefined();
        expect(synchronizeCallCount).toBe(1);
    });

    test('동시에 2개의 sync() 호출 시 같은 Promise를 공유하여 중복 방지', async () => {
        const { sync } = require('./sync');

        // 두 개의 sync를 동시에 시작
        const sync1Promise = sync();
        const sync2Promise = sync();

        // 둘 다 성공해야 함 (같은 Promise이므로)
        const results = await Promise.allSettled([sync1Promise, sync2Promise]);

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failureCount = results.filter((r) => r.status === 'rejected').length;

        // 둘 다 성공해야 함
        expect(successCount).toBe(2);
        expect(failureCount).toBe(0);
        // 실제로는 1번만 실행됨 (중복 방지 - 같은 Promise 공유)
        expect(synchronizeCallCount).toBe(1);
    });

    test('3개의 동시 sync() 호출 시 같은 Promise를 공유하여 중복 방지', async () => {
        const { sync } = require('./sync');

        // 세 개의 sync를 동시에 시작
        const promises = [sync(), sync(), sync()];

        const results = await Promise.allSettled(promises);

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failureCount = results.filter((r) => r.status === 'rejected').length;

        // 모두 성공해야 함 (같은 Promise이므로)
        expect(successCount).toBe(3);
        expect(failureCount).toBe(0);
        // 실제로는 1번만 실행됨 (중복 방지 - 같은 Promise 공유)
        expect(synchronizeCallCount).toBe(1);
    });

    test('순차적인 sync() 호출은 각각 실행됨', async () => {
        const { sync } = require('./sync');

        // 순차적으로 실행 (각 sync가 완료된 후 다음 호출)
        await expect(sync()).resolves.toBeDefined();
        await expect(sync()).resolves.toBeDefined();
        await expect(sync()).resolves.toBeDefined();

        // 순차 호출이므로 3번 모두 실행됨
        expect(synchronizeCallCount).toBe(3);
    });

    test('짧은 시간 간격으로 sync() 호출 시 같은 Promise를 공유', async () => {
        const { sync } = require('./sync');

        // 첫 번째 호출
        const sync1 = sync();

        // 10ms 후 두 번째 호출 (첫 번째가 아직 진행 중 - 100ms 소요)
        await new Promise((resolve) => setTimeout(resolve, 10));
        const sync2 = sync();

        const results = await Promise.allSettled([sync1, sync2]);

        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failureCount = results.filter((r) => r.status === 'rejected').length;

        // 둘 다 성공해야 함 (같은 Promise이므로)
        expect(successCount).toBe(2);
        expect(failureCount).toBe(0);
        // 실제로는 1번만 실행됨 (중복 방지 - 같은 Promise 공유)
        expect(synchronizeCallCount).toBe(1);
    });
});
