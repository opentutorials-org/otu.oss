'use client';
import { useState, useEffect } from 'react';
import { database } from '@/watermelondb';
import { Q } from '@nozbe/watermelondb';
import Alarm from '@/watermelondb/model/Alarm';
import { alarmLogger } from '@/debug/alarm';

/**
 * 여러 페이지의 알람 상태를 한번에 확인하는 훅
 * @param pageIds 확인할 페이지 ID 배열
 * @returns 각 페이지 ID를 키로 하고 알람 존재 여부를 값으로 하는 Map
 */
export function useAlarmsStatus(pageIds: string[]) {
    const [alarmStatuses, setAlarmStatuses] = useState<Map<string, boolean>>(new Map());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!pageIds || pageIds.length === 0) {
            setAlarmStatuses(new Map());
            return;
        }

        const checkAlarmStatuses = async () => {
            setLoading(true);
            try {
                const alarmCollection = database.collections.get<Alarm>('alarm');
                const alarms = await alarmCollection
                    .query(Q.where('page_id', Q.oneOf(pageIds)))
                    .fetch();

                const statusMap = new Map<string, boolean>();

                // 모든 페이지 ID를 false로 초기화
                pageIds.forEach((pageId) => {
                    statusMap.set(pageId, false);
                });

                // 알람이 있는 페이지는 true로 설정
                alarms.forEach((alarm) => {
                    statusMap.set(alarm.page_id, true);
                });

                setAlarmStatuses(statusMap);
                alarmLogger('useAlarmsStatus - 알람 상태 확인 완료', {
                    totalPages: pageIds.length,
                    pagesWithAlarms: alarms.length,
                    alarmPageIds: alarms.map((alarm) => alarm.page_id),
                });
            } catch (error) {
                alarmLogger('useAlarmsStatus - 알람 상태 확인 실패', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    pageIds: pageIds.length,
                });
            } finally {
                setLoading(false);
            }
        };

        checkAlarmStatuses();
    }, [pageIds]);

    return { alarmStatuses, loading };
}
