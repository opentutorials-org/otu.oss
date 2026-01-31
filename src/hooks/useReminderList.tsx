import { useEffect, useCallback, useState, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { ReminderPageData } from '@/lib/jotai';
import { getRemindersWithPageInfo } from '@/watermelondb/control/Alarm';
import { reminderLogger } from '@/debug/reminder';
import { fetchUserId } from '@/supabase/utils/client';
import { Q } from '@nozbe/watermelondb';

export function useReminderList(pageSize: number = 20) {
    const [reminders, setReminders] = useState<ReminderPageData[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    const loadReminders = useCallback(
        async (page: number = 0, append: boolean = false) => {
            if (!userId) {
                reminderLogger('사용자 ID가 없어 리마인더 데이터를 로드할 수 없음');
                return;
            }

            try {
                reminderLogger('리마인더 데이터 로드 시작', { page, pageSize, append });

                // 페이지네이션을 위한 오프셋 계산
                const offset = page * pageSize;

                // WatermelonDB에서 페이지네이션 적용하여 데이터 조회 (즉시 반환)
                const reminderData = await getRemindersWithPageInfo(userId, pageSize, offset);

                let newUniqueDataCount = reminderData.length;

                if (append) {
                    setReminders((prev) => {
                        // 중복 데이터 방지: 기존 ID 목록 생성
                        const existingIds = new Set(prev.map((item) => item.id));
                        // 새로운 데이터 중에서 중복되지 않는 것만 필터링
                        const newUniqueData = reminderData.filter(
                            (item) => !existingIds.has(item.id)
                        );
                        newUniqueDataCount = newUniqueData.length;
                        reminderLogger('데이터 중복 필터링', {
                            기존데이터수: prev.length,
                            새로운데이터수: reminderData.length,
                            중복제거후: newUniqueData.length,
                        });
                        return [...prev, ...newUniqueData];
                    });
                    // append 모드에서는 실제 추가된 데이터 수만큼 totalCount 증가
                    setTotalCount((prev) => prev + newUniqueDataCount);
                } else {
                    setReminders(reminderData);
                    setTotalCount(reminderData.length);
                }

                // 더 로드할 데이터가 있는지 확인 (실제 새로운 데이터가 있을 때만)
                setHasMore(newUniqueDataCount === pageSize);

                reminderLogger('리마인더 데이터 로드 완료', {
                    page,
                    원본데이터수: reminderData.length,
                    실제추가된데이터수: newUniqueDataCount,
                    hasMore: newUniqueDataCount === pageSize,
                    append,
                });
            } catch (error) {
                reminderLogger('리마인더 데이터 로드 실패', { error, page });
                console.error('Failed to load reminders:', error);
            }
        },
        [userId, pageSize]
    );

    // 사용자 ID 가져오기
    useEffect(function loadUserId() {
        const getUserId = async () => {
            try {
                const id = await fetchUserId('useReminderList');
                setUserId(id);
            } catch (error) {
                reminderLogger('사용자 ID 가져오기 실패', { error });
            }
        };
        getUserId();
    }, []);

    // 초기 마운트 시 사용자 ID가 있으면 즉시 리마인더 데이터 로드
    useEffect(
        function loadRemindersOnInitialMount() {
            if (userId) {
                loadReminders();
            }
        },
        [userId]
    ); // loadReminders 의존성 제거하여 무한 루프 방지

    // loadReminders 함수의 최신 버전을 참조하기 위한 ref
    const loadRemindersRef = useRef(loadReminders);
    loadRemindersRef.current = loadReminders;

    // WatermelonDB observe를 통한 실시간 업데이트
    useEffect(
        function observeAlarmChanges() {
            let subscription: any;

            const setupObserver = async () => {
                try {
                    if (!userId) return;

                    const { database } = await import('@/watermelondb');
                    const alarmCollection = database.collections.get('alarm');

                    // 사용자의 알람 변경사항 관찰
                    subscription = alarmCollection
                        .query(Q.where('user_id', userId))
                        .observe()
                        .subscribe(() => {
                            reminderLogger('알람 데이터 변경 감지 - 리마인더 리스트 업데이트');
                            // 현재 페이지 유지하며 데이터 새로고침
                            loadRemindersRef.current(0, false);
                        });
                } catch (err) {
                    reminderLogger('알람 관찰자 설정 실패', {
                        error: err instanceof Error ? err.message : 'Unknown error',
                    });
                }
            };

            setupObserver();

            return () => {
                if (subscription) {
                    subscription.unsubscribe();
                }
            };
        },
        [userId]
    );

    // 다음 페이지 로드
    const loadNextPage = useCallback(async () => {
        if (!hasMore) return;

        const nextPage = currentPage + 1;
        setCurrentPage(nextPage);
        await loadRemindersRef.current(nextPage, true);
    }, [hasMore, currentPage]);

    // 첫 페이지부터 다시 로드
    const reloadFromStart = useCallback(async () => {
        reminderLogger('reloadFromStart 호출됨 - 전체 리스트 새로고침');
        setCurrentPage(0);
        setTotalCount(0);
        setHasMore(true);
        setReminders([]); // 기존 데이터 초기화
        await loadRemindersRef.current(0, false);
    }, []);

    // 낙관적 업데이트: 삭제된 페이지들을 즉시 UI에서 제거
    const removePageIdsOptimistically = useCallback((pageIds: string[]) => {
        reminderLogger('낙관적 업데이트: 페이지 즉시 제거', { pageIds });
        setReminders((prev) => prev.filter((reminder) => !pageIds.includes(reminder.page_id)));
        setTotalCount((prev) => Math.max(0, prev - pageIds.length));
    }, []);

    return {
        reminders,
        reload: loadReminders,
        reloadFromStart,
        loadNextPage,
        hasMore,
        currentPage,
        totalCount,
        userId,
        removePageIdsOptimistically,
    };
}
