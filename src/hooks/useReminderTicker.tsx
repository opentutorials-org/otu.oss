'use client';

import { useState, useEffect, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/watermelondb';
import { ReminderTickerData } from '@/components/common/ReminderTicker';
import { reminderLogger } from '@/debug/reminder';
import { reminderTickerLogger } from '@/debug/reminderTicker';
import { fetchUserId } from '@/supabase/utils/client';

interface UseReminderTickerResult {
    reminders: ReminderTickerData[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useReminderTicker(limit: number = 30): UseReminderTickerResult {
    const [reminders, setReminders] = useState<ReminderTickerData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReminders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const alarmCollection = database.collections.get('alarm');
            const pageCollection = database.collections.get('page');

            // 현재 시간 이후의 알람들을 조회
            const currentTime = Date.now();
            const alarms = await alarmCollection.query(Q.take(limit)).fetch();

            // next_alarm_time 기준으로 정렬 (가까운 시간 순)
            alarms.sort((a, b) => {
                // @ts-ignore
                const aTime = a._raw.next_alarm_time || 0;
                // @ts-ignore
                const bTime = b._raw.next_alarm_time || 0;
                return aTime - bTime;
            });

            reminderLogger('알람 데이터 조회 완료', {
                alarmCount: alarms.length,
            });

            // 각 알람에 대해 관련 페이지 정보 조회
            const reminderData: ReminderTickerData[] = [];

            for (const alarm of alarms) {
                try {
                    // @ts-ignore
                    const pageId = alarm._raw.page_id;
                    const page = await pageCollection.find(pageId);

                    const tickerData: ReminderTickerData = {
                        id: alarm.id,
                        page_id: pageId,
                        // @ts-ignore
                        next_alarm_time: alarm._raw.next_alarm_time,
                        // @ts-ignore
                        page_title: page._raw.title || '',
                        // @ts-ignore
                        page_body: page._raw.body || '',
                        // @ts-ignore
                        page_type: page._raw.type as 'text' | 'draw',
                    };

                    reminderData.push(tickerData);
                } catch (pageError) {
                    // 페이지를 찾을 수 없는 경우 로그만 남기고 계속 진행
                    reminderLogger('페이지 정보 조회 실패', {
                        // @ts-ignore
                        pageId: alarm._raw.page_id,
                        error: pageError instanceof Error ? pageError.message : 'Unknown error',
                    });
                }
            }

            reminderLogger('리마인더 티커 데이터 로드 완료', {
                totalCount: reminderData.length,
            });
            reminderTickerLogger('리마인더 티커 데이터 로드 완료', {
                totalCount: reminderData.length,
                reminders: reminderData.map((r) => ({
                    id: r.id,
                    page_id: r.page_id,
                    next_alarm_time: r.next_alarm_time,
                })),
            });

            setReminders(reminderData);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            reminderLogger('리마인더 티커 데이터 로드 실패', { error: errorMessage });
            setError(errorMessage);
            setReminders([]);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    // 컴포넌트 마운트 시 데이터 로드
    useEffect(
        function initializeReminderTicker() {
            fetchReminders();
        },
        [fetchReminders]
    );

    // WatermelonDB observe를 통한 실시간 업데이트
    useEffect(
        function observeAlarmChanges() {
            let subscription: any;

            const setupObserver = async () => {
                try {
                    const userId = await fetchUserId('useReminderTicker-observer');
                    if (!userId) return;

                    const alarmCollection = database.collections.get('alarm');

                    // 사용자의 알람 변경사항 관찰
                    subscription = alarmCollection
                        .query(Q.where('user_id', userId))
                        .observe()
                        .subscribe(() => {
                            reminderLogger('알람 데이터 변경 감지 - 리마인더 티커 업데이트');
                            fetchReminders();
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
        [fetchReminders]
    );

    return {
        reminders,
        loading,
        error,
        refetch: fetchReminders,
    };
}
