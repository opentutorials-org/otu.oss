import { Q } from '@nozbe/watermelondb';
import { database } from '..';
import { reminderLogger } from '@/debug/reminder';
import { ReminderPageData } from '@/lib/jotai';
import { triggerSync } from '@/functions/sync';

// 사용자의 모든 알람을 조회하여 페이지 정보와 함께 반환 (페이지네이션 지원)
// 정렬: NULL 먼저 → next_alarm_time 오름차순 (가까운 시간 순)
export async function getRemindersWithPageInfo(
    userId: string,
    limit: number = 50,
    offset: number = 0
): Promise<ReminderPageData[]> {
    reminderLogger('리마인더 데이터 로드 시작', { userId, limit, offset });

    try {
        const alarmCollection = database.collections.get('alarm');
        const pageCollection = database.collections.get('page');

        // 1. NULL 항목 조회 (next_alarm_time이 null인 경우 - 아직 시간이 설정되지 않은 알람)
        const nullAlarms = await alarmCollection
            .query(Q.where('user_id', userId), Q.where('next_alarm_time', null))
            .fetch();

        const nullCount = nullAlarms.length;
        reminderLogger('NULL 알람 조회 완료', { nullCount });

        // 2. non-NULL 항목 조회 및 정렬 (next_alarm_time 오름차순 - 가까운 시간 순)
        const nonNullAlarms = await alarmCollection
            .query(
                Q.where('user_id', userId),
                Q.where('next_alarm_time', Q.notEq(null)),
                Q.sortBy('next_alarm_time', Q.asc)
            )
            .fetch();

        reminderLogger('non-NULL 알람 조회 완료', { nonNullCount: nonNullAlarms.length });

        // 3. 페이지네이션 계산 및 병합
        // NULL 항목을 먼저, 그 다음 정렬된 non-NULL 항목
        const allAlarms = [...nullAlarms, ...nonNullAlarms];
        const paginatedAlarms = allAlarms.slice(offset, offset + limit);

        reminderLogger('알람 데이터 병합 및 페이지네이션 완료', {
            userId,
            totalCount: allAlarms.length,
            nullCount,
            nonNullCount: nonNullAlarms.length,
            offset,
            limit,
            paginatedCount: paginatedAlarms.length,
        });

        // 4. 각 알람에 대해 관련 페이지 정보 조회
        const remindersWithPageInfo: ReminderPageData[] = [];

        for (const alarm of paginatedAlarms) {
            try {
                // 페이지 정보 조회
                // @ts-ignore
                const page = await pageCollection.find(alarm._raw.page_id);

                const reminderData: ReminderPageData = {
                    id: alarm.id,
                    // @ts-ignore
                    page_id: alarm._raw.page_id,
                    // @ts-ignore
                    user_id: alarm._raw.user_id,
                    // @ts-ignore
                    next_alarm_time: alarm._raw.next_alarm_time,
                    // @ts-ignore
                    sent_count: alarm._raw.sent_count,
                    // @ts-ignore
                    last_notification_id: alarm._raw.last_notification_id,
                    // @ts-ignore
                    created_at: alarm._raw.created_at,
                    // @ts-ignore
                    updated_at: alarm._raw.updated_at,
                    // 페이지 정보
                    // @ts-ignore
                    page_title: page._raw.title,
                    // @ts-ignore
                    page_body: page._raw.body,
                    // @ts-ignore
                    page_created_at: page._raw.created_at,
                    // @ts-ignore
                    page_updated_at: page._raw.updated_at,
                    // @ts-ignore
                    page_type: page._raw.type as 'text' | 'draw',
                    // @ts-ignore
                    page_folder_id: page._raw.folder_id,
                    // @ts-ignore
                    page_img_url: page._raw.img_url || null,
                };

                remindersWithPageInfo.push(reminderData);
            } catch (pageError) {
                // 페이지를 찾을 수 없는 경우 로그만 남기고 계속 진행
                reminderLogger('페이지 정보 조회 실패', {
                    // @ts-ignore
                    pageId: alarm._raw.page_id,
                    error: pageError instanceof Error ? pageError.message : 'Unknown error',
                });
            }
        }

        reminderLogger('리마인더 데이터 로드 완료', {
            userId,
            totalCount: remindersWithPageInfo.length,
        });

        return remindersWithPageInfo;
    } catch (error) {
        reminderLogger('리마인더 데이터 로드 실패', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// 여러 페이지의 알람을 삭제하는 함수
export async function deleteAlarmsByPageIds(pageIds: string[]): Promise<number> {
    reminderLogger('알람 삭제 시작', { pageIds, count: pageIds.length });

    try {
        const alarmCollection = database.collections.get('alarm');

        // 삭제할 알람들 조회
        const alarmsToDelete = await alarmCollection
            .query(Q.where('page_id', Q.oneOf(pageIds)))
            .fetch();

        reminderLogger('삭제할 알람 조회 완료', {
            foundCount: alarmsToDelete.length,
            alarmIds: alarmsToDelete.map((a) => a.id.substring(0, 8) + '...'),
        });

        if (alarmsToDelete.length === 0) {
            reminderLogger('삭제할 알람이 없음');
            return 0;
        }

        // WatermelonDB에서 알람 삭제
        await database.write(async () => {
            await Promise.all(alarmsToDelete.map((alarm) => alarm.markAsDeleted()));
        });

        reminderLogger('알람 삭제 완료', { deletedCount: alarmsToDelete.length });

        // 삭제 후 동기화 트리거
        triggerSync('watermelondb/control/Alarm/deleteAlarmsByPageIds');

        return alarmsToDelete.length;
    } catch (error) {
        reminderLogger('알람 삭제 실패', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
