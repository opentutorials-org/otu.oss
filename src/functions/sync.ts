import debounce from 'lodash/debounce';

// 디바운싱된 동기화 트리거 함수
const debouncedTriggerSyncImpl = debounce(
    async (source: string) => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            // 폴더 정보 업데이트
            const { syncAllFoldersInfoSilent } = await import('@/functions/folder');
            await syncAllFoldersInfoSilent();

            // 전역 상태 업데이트 및 sync 실행
            const { refreshFoldersState, refreshListState, runSyncState } = await import(
                '@/lib/jotai'
            );
            const { getDefaultStore } = await import('jotai');
            const store = getDefaultStore();

            store.set(refreshFoldersState, (prev) => prev + 1);

            store.set(runSyncState, {});
        } catch (error) {
            // 동기화 실패해도 로컬 작업은 이미 완료된 상태
            console.error('triggerSync error:', error);
        }
    },
    2000, // 2초 디바운싱
    { leading: false, trailing: true }
);

/**
 * 동기화를 트리거하는 함수 (디바운싱 적용)
 * 2초 이내의 중복 호출은 마지막 것만 실행됩니다.
 *
 * @param source - 동기화를 호출한 위치 (디버깅용)
 */
export function triggerSync(source: string): void {
    debouncedTriggerSyncImpl(source);
}
