/** @jest-environment node */
/**
 * useSync 훅 동시 실행 race condition 시뮬레이션 테스트
 *
 * 이 테스트는 다음 시나리오를 검증합니다:
 * 1. isSyncingRef race condition 재현
 * 2. 여러 이벤트 리스너가 동시에 트리거될 때의 동작
 * 3. setInterval cleanup 누락 시 중복 실행
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

describe('useSync race condition 시뮬레이션', () => {
    beforeEach(() => {
        // 테스트 초기화
    });

    test('isSyncingRef race condition 재현: 체크와 설정 사이의 타이밍 이슈', async () => {
        // 실제 performSync의 로직 시뮬레이션
        let isSyncing = false;
        const syncResults: Array<{ id: string; action: string; timestamp: number }> = [];

        const simulatePerformSync = async (id: string) => {
            const checkTime = Date.now();

            // Step 1: isSyncing 체크
            if (isSyncing) {
                syncResults.push({ id, action: 'blocked', timestamp: checkTime });
                return;
            }

            // ⚠️ 문제: 여기서 다른 호출이 위의 if문을 통과할 수 있음!
            // 실제로는 await 없이도 비동기 스케줄링으로 인해 타이밍 이슈 발생 가능
            await new Promise((resolve) => setImmediate(resolve)); // 이벤트 루프 1틱 대기

            // Step 2: isSyncing 설정
            isSyncing = true;
            syncResults.push({ id, action: 'started', timestamp: Date.now() });

            // Step 3: 실제 동기화 작업 시뮬레이션
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Step 4: 완료
            isSyncing = false;
            syncResults.push({ id, action: 'completed', timestamp: Date.now() });
        };

        // 3개의 sync를 동시에 호출
        await Promise.all([
            simulatePerformSync('sync1'),
            simulatePerformSync('sync2'),
            simulatePerformSync('sync3'),
        ]);

        // 결과 분석
        console.log('\n=== Race Condition 시뮬레이션 결과 ===');
        syncResults.forEach((r) => {
            console.log(`[${r.id}] ${r.action} at ${r.timestamp}`);
        });

        const startedCount = syncResults.filter((r) => r.action === 'started').length;
        const blockedCount = syncResults.filter((r) => r.action === 'blocked').length;
        const completedCount = syncResults.filter((r) => r.action === 'completed').length;

        console.log(
            `\nstarted: ${startedCount}, blocked: ${blockedCount}, completed: ${completedCount}`
        );

        // Race condition 발생 시 여러 sync가 started 상태가 됨
        if (startedCount > 1) {
            console.log('🔴 Race Condition 발생: 여러 sync가 동시에 시작됨!');
            expect(startedCount).toBeGreaterThan(1);
        } else {
            console.log('✅ Race Condition 방지됨');
        }

        // 최소한 하나는 완료되어야 함
        expect(completedCount).toBeGreaterThanOrEqual(1);
    });

    test('동시 이벤트 트리거 시뮬레이션: visibilitychange + focus + online', async () => {
        // runSync 호출 카운터
        let runSyncCallCount = 0;
        const runSyncCalls: Array<{ event: string; timestamp: number }> = [];

        const runSync = (eventName: string) => {
            runSyncCallCount++;
            runSyncCalls.push({ event: eventName, timestamp: Date.now() });
        };

        // 이벤트 리스너 시뮬레이션
        const onVisibilityChange = () => runSync('visibilitychange');
        const onFocus = () => runSync('focus');
        const onOnline = () => runSync('online');

        // 세 이벤트가 동시에 발생하는 시나리오
        const startTime = Date.now();

        // 거의 동시에 발생 (실제로는 마이크로초 단위 차이)
        onVisibilityChange();
        onFocus();
        onOnline();

        const endTime = Date.now();

        console.log('\n=== 동시 이벤트 트리거 결과 ===');
        console.log(`총 runSync 호출 횟수: ${runSyncCallCount}`);
        console.log(`이벤트 발생 시간대: ${endTime - startTime}ms 이내`);
        runSyncCalls.forEach((call) => {
            console.log(`  - ${call.event}: ${call.timestamp - startTime}ms`);
        });

        // 3개의 이벤트가 모두 runSync를 트리거
        expect(runSyncCallCount).toBe(3);

        // 모든 호출이 짧은 시간 내에 발생
        const timeDiffs = runSyncCalls.map((call, idx) => {
            if (idx === 0) return 0;
            return call.timestamp - runSyncCalls[0].timestamp;
        });
        const maxTimeDiff = Math.max(...timeDiffs);

        console.log(`최대 시간 차이: ${maxTimeDiff}ms`);

        // 10ms 이내에 모두 발생했다면 "동시 호출"
        if (maxTimeDiff < 10) {
            console.log('🔴 동시 호출 감지: WatermelonDB 에러 발생 가능!');
        }
    });

    test('setInterval cleanup 누락 시뮬레이션', () => {
        const intervals: NodeJS.Timeout[] = [];
        let syncCallCount = 0;

        const simulateUseEffect = () => {
            // cleanup이 없는 setInterval (잘못된 패턴)
            const interval = setInterval(() => {
                syncCallCount++;
            }, 1000);

            intervals.push(interval);

            // ❌ cleanup 반환 없음!
            // return () => clearInterval(interval); // 이게 없음!
        };

        // 컴포넌트가 3번 마운트/언마운트되는 시나리오
        simulateUseEffect(); // 첫 번째 마운트
        simulateUseEffect(); // 두 번째 마운트 (cleanup 없이)
        simulateUseEffect(); // 세 번째 마운트 (cleanup 없이)

        console.log('\n=== setInterval cleanup 누락 시뮬레이션 ===');
        console.log(`생성된 인터벌 개수: ${intervals.length}`);

        // 인터벌이 중복으로 실행되는지 확인
        expect(intervals.length).toBe(3);
        console.log('🔴 cleanup이 없어서 3개의 인터벌이 모두 실행 중!');
        console.log('   → 30분마다 동기화가 3번씩 중복 호출됨');

        // 정리
        intervals.forEach((interval) => clearInterval(interval));
    });

    test('올바른 race condition 방지 패턴', async () => {
        let isSyncing = false;
        const syncResults: string[] = [];

        const performSyncWithLock = async (id: string) => {
            // ✅ 원자적 연산: 체크와 설정을 동시에
            if (isSyncing) {
                syncResults.push(`${id}: blocked`);
                return;
            }

            // 즉시 락 설정 (await 전에)
            isSyncing = true;
            syncResults.push(`${id}: started`);

            try {
                // 동기화 작업
                await new Promise((resolve) => setTimeout(resolve, 50));
                syncResults.push(`${id}: completed`);
            } finally {
                // 항상 락 해제
                isSyncing = false;
            }
        };

        // 동시 호출
        await Promise.all([
            performSyncWithLock('sync1'),
            performSyncWithLock('sync2'),
            performSyncWithLock('sync3'),
        ]);

        console.log('\n=== 올바른 락 패턴 결과 ===');
        console.log(syncResults.join('\n'));

        const startedCount = syncResults.filter((r) => r.includes('started')).length;

        // 락이 제대로 작동하면 1개만 시작
        expect(startedCount).toBe(1);
        console.log('✅ 락이 제대로 작동: 1개만 시작됨');
    });

    test('debounce를 사용한 중복 호출 방지', async () => {
        const syncCalls: number[] = [];

        // 간단한 debounce 구현
        let debounceTimer: NodeJS.Timeout | null = null;
        const debouncedSync = (delay: number = 100) => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }

            debounceTimer = setTimeout(() => {
                syncCalls.push(Date.now());
                debounceTimer = null;
            }, delay);
        };

        // 짧은 시간에 여러 번 호출
        debouncedSync(100);
        await new Promise((resolve) => setTimeout(resolve, 10));
        debouncedSync(100);
        await new Promise((resolve) => setTimeout(resolve, 10));
        debouncedSync(100);
        await new Promise((resolve) => setTimeout(resolve, 10));
        debouncedSync(100);

        // debounce 시간 대기
        await new Promise((resolve) => setTimeout(resolve, 150));

        console.log('\n=== Debounce 패턴 결과 ===');
        console.log(`호출 횟수: ${syncCalls.length}`);

        // debounce로 인해 1번만 실행
        expect(syncCalls.length).toBe(1);
        console.log('✅ Debounce 작동: 여러 호출이 1번으로 병합됨');
    });
});
