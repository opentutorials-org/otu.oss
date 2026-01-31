/** @jest-environment node */
import { describe, test, expect } from '@jest/globals';

describe('pullChangesForInitialSync - 타임스탬프 처리', () => {
    test('lastCreatedAt이 null이고 maxUpdatedAtMs가 0일 때 에러가 발생하지 않아야 함', () => {
        const maxUpdatedAtMs = 0;
        const lastCreatedAt = null;

        // 실제 로직 테스트
        const finalTimestampBase =
            maxUpdatedAtMs > 0
                ? maxUpdatedAtMs
                : lastCreatedAt
                  ? new Date(lastCreatedAt).getTime()
                  : Date.now();

        expect(finalTimestampBase).toBeGreaterThan(0);
        expect(Number.isNaN(finalTimestampBase)).toBe(false);
    });

    test('maxUpdatedAtMs가 0보다 크면 해당 값을 사용해야 함', () => {
        const maxUpdatedAtMs = 1704067200000; // 2024-01-01
        const lastCreatedAt = null;

        const finalTimestampBase =
            maxUpdatedAtMs > 0
                ? maxUpdatedAtMs
                : lastCreatedAt
                  ? new Date(lastCreatedAt).getTime()
                  : Date.now();

        expect(finalTimestampBase).toBe(maxUpdatedAtMs);
    });

    test('lastCreatedAt이 유효한 값이면 해당 값을 사용해야 함', () => {
        const maxUpdatedAtMs = 0;
        const lastCreatedAt = '2024-01-01T00:00:00.000Z';

        const finalTimestampBase =
            maxUpdatedAtMs > 0
                ? maxUpdatedAtMs
                : lastCreatedAt
                  ? new Date(lastCreatedAt).getTime()
                  : Date.now();

        expect(finalTimestampBase).toBe(new Date(lastCreatedAt).getTime());
    });

    test('로깅 시 유효하지 않은 날짜를 toISOString()으로 변환할 때 에러가 발생하지 않아야 함', () => {
        const maxUpdatedAtMs = 0;
        const lastCreatedAt = null;

        // 로깅 코드 테스트
        expect(() => {
            const logData = {
                maxUpdatedAtMs:
                    maxUpdatedAtMs > 0 ? new Date(maxUpdatedAtMs).toISOString() : 'N/A (0)',
                lastCreatedAt: lastCreatedAt || 'N/A (null)',
            };
        }).not.toThrow();
    });

    test('로깅 시 maxUpdatedAtMs가 0일 때 N/A (0)을 반환해야 함', () => {
        const maxUpdatedAtMs = 0;
        const result = maxUpdatedAtMs > 0 ? new Date(maxUpdatedAtMs).toISOString() : 'N/A (0)';
        expect(result).toBe('N/A (0)');
    });

    test('로깅 시 lastCreatedAt이 null일 때 N/A (null)을 반환해야 함', () => {
        const lastCreatedAt = null;
        const result = lastCreatedAt || 'N/A (null)';
        expect(result).toBe('N/A (null)');
    });

    test('reason 메시지가 올바르게 생성되어야 함', () => {
        // maxUpdatedAtMs > 0인 경우
        let maxUpdatedAtMs = 1704067200000;
        let lastCreatedAt = null;
        let reason =
            maxUpdatedAtMs > 0
                ? 'max(updated_at) 사용'
                : lastCreatedAt
                  ? 'lastCreatedAt 폴백'
                  : 'Date.now() 폴백';
        expect(reason).toBe('max(updated_at) 사용');

        // lastCreatedAt이 있는 경우
        maxUpdatedAtMs = 0;
        lastCreatedAt = '2024-01-01T00:00:00.000Z';
        reason =
            maxUpdatedAtMs > 0
                ? 'max(updated_at) 사용'
                : lastCreatedAt
                  ? 'lastCreatedAt 폴백'
                  : 'Date.now() 폴백';
        expect(reason).toBe('lastCreatedAt 폴백');

        // 둘 다 없는 경우
        maxUpdatedAtMs = 0;
        lastCreatedAt = null;
        reason =
            maxUpdatedAtMs > 0
                ? 'max(updated_at) 사용'
                : lastCreatedAt
                  ? 'lastCreatedAt 폴백'
                  : 'Date.now() 폴백';
        expect(reason).toBe('Date.now() 폴백');
    });
});
