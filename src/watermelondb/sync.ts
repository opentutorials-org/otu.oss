import { SyncPullArgs, synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import { syncLogger } from '@/debug/sync';
import * as Sentry from '@sentry/nextjs';
import { Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

type progressEventType = {
    name: string;
    progress?: string | null;
    isInitialSync?: boolean;
};

export type SyncResult = {
    pullCount: number;
    pullItems: {
        page: { created: any[]; updated: any[]; deleted: any[] };
        folder: { created: any[]; updated: any[]; deleted: any[] };
        alarm: { created: any[]; updated: any[]; deleted: any[] };
    };
    pushCount: number;
    pushItems: {
        page: { created: any[]; updated: any[]; deleted: any[] };
        folder: { created: any[]; updated: any[]; deleted: any[] };
        alarm: { created: any[]; updated: any[]; deleted: any[] };
    };
    totalCount: number;
    startPulledAt: any;
};

const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
};

// 전역 동기화 잠금 메커니즘
let isSyncing = false;
let currentSyncPromise: Promise<SyncResult> | null = null;

export async function sync(
    isReset?: boolean,
    onProgress?: (progress: progressEventType) => void
): Promise<SyncResult> {
    // 동기화가 진행 중인 경우 현재 진행 중인 sync를 반환
    if (isSyncing && currentSyncPromise) {
        syncLogger('동기화가 이미 진행 중입니다. 현재 요청을 무시합니다.');
        return currentSyncPromise;
    }

    // 동기화 시작
    isSyncing = true;
    currentSyncPromise = performSync(isReset, onProgress)
        .then((result) => {
            return result;
        })
        .catch((error) => {
            throw error;
        })
        .finally(() => {
            isSyncing = false;
            currentSyncPromise = null;
        });

    return currentSyncPromise;
}

async function performSync(
    isReset?: boolean,
    onProgress?: (progress: progressEventType) => void
): Promise<SyncResult> {
    let pullCount = 0; // pull에서 변경된 데이터의 갯수
    let pullItems = {
        page: { created: [], updated: [], deleted: [] },
        folder: { created: [], updated: [], deleted: [] },
        alarm: { created: [], updated: [], deleted: [] },
    };
    let pushCount = 0; // push에서 변경된 데이터의 갯수
    let pushItems = {
        page: { created: [], updated: [], deleted: [] },
        folder: { created: [], updated: [], deleted: [] },
        alarm: { created: [], updated: [], deleted: [] },
    };
    let startPulledAt; // pull 시작 시간
    let isInitialSync = false; // 최초 동기화 여부

    if (onProgress) onProgress({ name: 'start', progress: null, isInitialSync: false });
    const result = await synchronize({
        database,
        pullChanges: async (params) => {
            syncLogger('pullChanges', 'params:', params, 'isReset:', isReset);
            if (onProgress) onProgress({ name: 'pull_start', isInitialSync: false });
            let syncResult;
            if (params.lastPulledAt === null || isReset) {
                isInitialSync = true; // 최초 동기화 여부 설정
                syncResult = await pullChangesForInitialSync(params, (progress) => {
                    if (onProgress)
                        onProgress({ name: 'pull_progress', progress, isInitialSync: true });
                });
                isReset = true;
                syncLogger('initial sync', syncResult);
            } else {
                syncResult = await pullChangesForSync(params);
                syncLogger('normal sync', syncResult);
            }
            pullCount = syncResult.pullCount;
            pullItems = syncResult.changes;
            // @ts-ignore
            startPulledAt = syncResult.startPulledAt;
            const result = {
                changes: syncResult.changes,
                timestamp: syncResult.timestamp,
            };
            syncLogger('pullChanges result', result);
            if (onProgress) onProgress({ name: 'pull_end', isInitialSync });
            return result;
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
            if (onProgress) onProgress({ name: 'push_start', isInitialSync });
            if (isReset) {
                syncLogger('push skipped', changes, lastPulledAt);
                return;
            }
            // page, folder, alarm 테이블 모두 포함
            // @ts-ignore
            changes = {
                // @ts-ignore
                page: changes.page || { created: [], updated: [], deleted: [] },
                // @ts-ignore
                folder: changes.folder || { created: [], updated: [], deleted: [] },
                // @ts-ignore
                alarm: changes.alarm || { created: [], updated: [], deleted: [] },
            };
            // @ts-ignore
            pushCount +=
                // @ts-ignore
                changes.page.created.length +
                // @ts-ignore
                changes.page.updated.length +
                // @ts-ignore
                changes.page.deleted.length +
                // @ts-ignore
                (changes.folder.created.length +
                    // @ts-ignore
                    changes.folder.updated.length +
                    // @ts-ignore
                    changes.folder.deleted.length) +
                // @ts-ignore
                (changes.alarm.created.length +
                    // @ts-ignore
                    changes.alarm.updated.length +
                    // @ts-ignore
                    changes.alarm.deleted.length);
            // @ts-ignore
            pushItems = changes;

            if (pushCount > 0) {
                const response = await fetch(`/api/sync/push?last_pulled_at=${lastPulledAt}`, {
                    method: 'POST',
                    body: JSON.stringify(changes),
                });
                if (!response.ok) {
                    throw new Error(await response.text());
                }
            }
            if (onProgress) onProgress({ name: 'push_end', isInitialSync });
            syncLogger('pushChanges result', changes, lastPulledAt);
            Sentry.addBreadcrumb({
                category: 'sync',
                message: `pushChanges end`,
                level: 'info',
            });
        },
        migrationsEnabledAtVersion: 1,
    });
    // 폴더 정보는 이제 sync 실행 전에 미리 업데이트됨 (triggerSync에서 처리)

    const finalSyncResult = {
        pullCount,
        pullItems,
        pushCount,
        pushItems,
        totalCount: pullCount + pushCount,
        startPulledAt,
    };
    Sentry.addBreadcrumb({
        category: 'sync',
        message: `pullChangesForSync end`,
        level: 'info',
        data: finalSyncResult,
    });
    syncLogger('finalSyncResult', finalSyncResult);
    if (onProgress) onProgress({ name: 'end', progress: null, isInitialSync });
    return finalSyncResult;
}

async function pullChangesForSync({ lastPulledAt, schemaVersion, migration }: SyncPullArgs) {
    Sentry.addBreadcrumb({
        category: 'sync',
        message: `pullChangesForSync start`,
        level: 'info',
    });
    let pullCount = 0; // pull에서 변경된 데이터의 갯수
    const urlParams = `last_pulled_at=${lastPulledAt}&schema_version=${schemaVersion}&migration=${encodeURIComponent(
        JSON.stringify(migration)
    )}`;
    const response = await fetch(`/api/sync/pull?${urlParams}`);
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const { changes, timestamp } = await response.json();
    syncLogger('pullChangesForSync url', urlParams, 'changes', changes, 'timestamp', timestamp);

    // 증분 동기화에서 받은 문자열 시간 필드를 ms 숫자로 정규화
    const normalizeTimeFields = (record: any) => {
        const normalized = { ...record };

        // 공통 시간 필드 정규화
        if (normalized.created_at && typeof normalized.created_at === 'string') {
            normalized.created_at = new Date(normalized.created_at).getTime();
        }
        if (normalized.updated_at && typeof normalized.updated_at === 'string') {
            normalized.updated_at = new Date(normalized.updated_at).getTime();
        }

        // 폴더 전용 필드
        if (normalized.last_page_added_at && typeof normalized.last_page_added_at === 'string') {
            normalized.last_page_added_at = new Date(normalized.last_page_added_at).getTime();
        }

        // 알람 전용 필드 (이미 서버에서 ms로 변환되어 오지만 방어적 처리)
        if (normalized.next_alarm_time && typeof normalized.next_alarm_time === 'string') {
            normalized.next_alarm_time = new Date(normalized.next_alarm_time).getTime();
        }

        return normalized;
    };

    // 모든 테이블의 created/updated 레코드에 시간 정규화 적용
    const normalizedChanges = {
        page: {
            created: changes.page.created.map(normalizeTimeFields),
            updated: changes.page.updated.map(normalizeTimeFields),
            deleted: changes.page.deleted,
        },
        folder: {
            created: changes.folder.created.map(normalizeTimeFields),
            updated: changes.folder.updated.map(normalizeTimeFields),
            deleted: changes.folder.deleted,
        },
        alarm: {
            created: changes.alarm.created.map(normalizeTimeFields),
            updated: changes.alarm.updated.map(normalizeTimeFields),
            deleted: changes.alarm.deleted,
        },
    };

    syncLogger('증분 동기화 시간 필드 정규화 완료', {
        pageCreated: normalizedChanges.page.created.length,
        pageUpdated: normalizedChanges.page.updated.length,
        folderCreated: normalizedChanges.folder.created.length,
        folderUpdated: normalizedChanges.folder.updated.length,
        alarmCreated: normalizedChanges.alarm.created.length,
        alarmUpdated: normalizedChanges.alarm.updated.length,
    });

    // pull에서 변경된 데이터의 갯수 계산
    Object.values(normalizedChanges).forEach((tableChanges) => {
        pullCount +=
            // @ts-ignore
            tableChanges.created.length +
            // @ts-ignore
            tableChanges.updated.length +
            // @ts-ignore
            tableChanges.deleted.length;
    });

    const result = {
        changes: normalizedChanges,
        timestamp,
        pullCount,
        startPulledAt: lastPulledAt,
    };
    syncLogger('pullChangesForSync result', result);
    Sentry.addBreadcrumb({
        category: 'sync',
        message: `pullChangesForSync end`,
        level: 'info',
        data: { timestamp, pullCount, startPulledAt: lastPulledAt },
    });
    return result;
}

export async function pullChangesForInitialSync(
    { lastPulledAt }: SyncPullArgs,
    onProgress: (progress: string) => void
) {
    // 전체 시간 측정 시작
    const totalStartTime = performance.now();

    Sentry.addBreadcrumb({
        category: 'sync',
        message: 'pullChangesForInitialSync start',
        level: 'info',
    });
    onProgress('');

    // 최초 동기화 전에 로컬 DB에 데이터가 있는지 확인
    const pageCollection = database.collections.get('page');
    const existingRecordsCount = await pageCollection.query().fetchCount();

    // 데이터 존재 여부에 따라 동기화 방식 결정
    const shouldSkipDuplicateCheck = existingRecordsCount === 0;

    if (shouldSkipDuplicateCheck) {
        syncLogger('로컬 DB에 데이터가 없으므로 중복 체크를 건너뛰고 빠른 동기화를 수행합니다.');
    } else {
        syncLogger('로컬 DB에 이미 데이터가 있으므로 중복 체크를 수행합니다.', {
            existingRecordsCount,
        });
    }

    let pullCount = 0;
    let timestamp = lastPulledAt || 0;
    let lastCreatedAt = null;
    let lastId = null; // 커서 기반으로 추가된 lastId
    const BATCH = 50;
    let hasMore = true;

    // 최초 동기화에서 수집한 모든 데이터의 max(updated_at) 추적
    let maxUpdatedAtMs = 0;

    // 배치별 성능 측정 데이터
    const batchPerformance = [];
    let batchCount = 0;

    // 폴더 데이터 동기화 (첫 번째 배치에서만)
    let foldersSynced = false;
    let foldersCount = 0;

    // 알람 데이터 동기화 (첫 번째 배치에서만)
    let alarmsSynced = false;
    let alarmsCount = 0;

    while (hasMore) {
        // 배치 처리 시간 측정 시작
        const batchStartTime = performance.now();

        const created_at_query: string = lastCreatedAt
            ? `?created_at=${encodeURIComponent(lastCreatedAt)}&last_id=${encodeURIComponent(
                  lastId || ''
              )}`
            : '';
        const url = `/api/sync/pull/all${created_at_query}`;
        const resp = await fetch(url);
        const result = await resp.json();
        const pages = result.pages || []; // 페이지 데이터 추가
        const folders = result.folders || []; // 폴더 데이터 추가
        const alarms = result.alarms || []; // 알람 데이터 추가
        lastCreatedAt = result.created_at; // 커서로 받는 created_at
        lastId = result.lastId; // 커서로 받는 lastId

        // 서버의 hasMore 값을 확인하여 동기화 중단 여부 결정
        if (result.hasMore === false) {
            hasMore = false;
            syncLogger('서버에서 더 이상 데이터가 없다고 알림', {
                pagesCount: pages.length,
                foldersCount: folders.length,
                alarmsCount: alarms.length,
                lastCreatedAt,
                lastId: lastId?.substring(0, 8) + '...' || null,
            });
            // 마지막 배치 데이터 처리 후 종료
        } else if (pages.length === 0) {
            hasMore = false;
            syncLogger('모든 페이지를 가져왔습니다.');
            break;
        }

        // 현재 배치의 max(updated_at) 계산 - 메모리 효율적 방법
        let batchMaxUpdatedAt = 0;

        // 페이지 데이터에서 최대값 찾기
        pages.forEach((page: any) => {
            const updatedAt = page.updated_at || page.created_at;
            if (updatedAt) {
                const timeMs = new Date(updatedAt).getTime();
                if (timeMs > batchMaxUpdatedAt) {
                    batchMaxUpdatedAt = timeMs;
                }
            }
        });

        // 폴더 데이터에서 최대값 찾기
        folders.forEach((folder: any) => {
            const updatedAt = folder.updated_at || folder.created_at;
            if (updatedAt) {
                const timeMs = new Date(updatedAt).getTime();
                if (timeMs > batchMaxUpdatedAt) {
                    batchMaxUpdatedAt = timeMs;
                }
            }
        });

        // 알람 데이터에서 최대값 찾기
        alarms.forEach((alarm: any) => {
            const updatedAt = alarm.updated_at || alarm.created_at;
            if (updatedAt) {
                const timeMs = new Date(updatedAt).getTime();
                if (timeMs > batchMaxUpdatedAt) {
                    batchMaxUpdatedAt = timeMs;
                }
            }
        });

        // 전체 최대값 갱신
        if (batchMaxUpdatedAt > maxUpdatedAtMs) {
            maxUpdatedAtMs = batchMaxUpdatedAt;

            syncLogger('배치 max(updated_at) 갱신', {
                batchNumber: batchCount + 1,
                batchMaxUpdatedAt: new Date(batchMaxUpdatedAt).toISOString(),
                globalMaxUpdatedAt: new Date(maxUpdatedAtMs).toISOString(),
                pagesCount: pages.length,
                foldersCount: folders.length,
                alarmsCount: alarms.length,
            });
        }

        // 데이터베이스 쓰기 시간 측정 시작
        const dbWriteStartTime = performance.now();

        await database.write(async () => {
            try {
                // 폴더 데이터 처리 (첫 번째 배치에서만)
                if (!foldersSynced && folders.length > 0) {
                    const folderCollection = database.collections.get('folder');

                    if (shouldSkipDuplicateCheck) {
                        // 중복 체크 없이 모든 폴더 생성
                        const folderBatch = folders.map((folder: any) => {
                            return folderCollection.prepareCreate((folderModel) => {
                                folderModel._raw.id = folder.id;
                                // @ts-ignore
                                folderModel.name = folder.name;
                                // @ts-ignore
                                folderModel.description = folder.description || '';
                                // @ts-ignore
                                folderModel.thumbnail_url = folder.thumbnail_url || '';
                                // @ts-ignore
                                folderModel.page_count = folder.page_count || 0;
                                // @ts-ignore
                                folderModel.createdAt = folder.created_at
                                    ? new Date(folder.created_at).getTime()
                                    : Date.now();
                                // @ts-ignore
                                folderModel.updatedAt = folder.updated_at
                                    ? new Date(folder.updated_at).getTime()
                                    : folder.created_at
                                      ? new Date(folder.created_at).getTime()
                                      : Date.now();
                                // @ts-ignore
                                folderModel.last_page_added_at = folder.last_page_added_at
                                    ? new Date(folder.last_page_added_at).getTime()
                                    : null;
                                // @ts-ignore
                                folderModel.user_id = folder.user_id;
                            });
                        });

                        syncLogger('중복 체크 없이 폴더 데이터베이스에 batch insert 기능 실행', {
                            batchLength: folderBatch.length,
                        });

                        await database.batch(...folderBatch);
                        foldersCount += folderBatch.length;
                    } else {
                        // 중복 체크 후 폴더 생성/업데이트
                        const existingFolders = await folderCollection
                            .query(
                                Q.where(
                                    'id',
                                    Q.oneOf(folders.map((folder: { id: string }) => folder.id))
                                )
                            )
                            .fetch();

                        const existingFoldersMap = new Map(
                            existingFolders.map((folder) => [folder.id, folder])
                        );

                        const folderBatch = folders.reduce((acc: Model[], folder: any) => {
                            if (existingFoldersMap.has(folder.id)) {
                                syncLogger(
                                    '이미 존재하는 folder',
                                    folder.id,
                                    '기존의 데이터를 업데이트 합니다.'
                                );
                                // Folder exists - prepare update operation
                                const existingFolder = existingFoldersMap.get(folder.id);
                                const updatedFolder = existingFolder?.prepareUpdate(
                                    (folderModel) => {
                                        // @ts-ignore
                                        folderModel.name = folder.name;
                                        // @ts-ignore
                                        folderModel.description = folder.description || '';
                                        // @ts-ignore
                                        folderModel.thumbnail_url = folder.thumbnail_url || '';
                                        // @ts-ignore
                                        folderModel.page_count = folder.page_count || 0;
                                        // @ts-ignore
                                        folderModel.updatedAt = folder.updated_at
                                            ? new Date(folder.updated_at).getTime()
                                            : // @ts-ignore
                                              folderModel.updatedAt;
                                        // @ts-ignore
                                        folderModel.last_page_added_at = folder.last_page_added_at
                                            ? new Date(folder.last_page_added_at).getTime()
                                            : // @ts-ignore
                                              folderModel.last_page_added_at;
                                        // @ts-ignore
                                        folderModel.user_id = folder.user_id;
                                    }
                                );
                                if (updatedFolder) {
                                    acc.push(updatedFolder);
                                }
                            } else {
                                // Folder does not exist - prepare create operation
                                const newFolder = folderCollection.prepareCreate((folderModel) => {
                                    folderModel._raw.id = folder.id;
                                    // @ts-ignore
                                    folderModel.name = folder.name;
                                    // @ts-ignore
                                    folderModel.description = folder.description || '';
                                    // @ts-ignore
                                    folderModel.thumbnail_url = folder.thumbnail_url || '';
                                    // @ts-ignore
                                    folderModel.page_count = folder.page_count || 0;
                                    // @ts-ignore
                                    folderModel.createdAt = folder.created_at
                                        ? new Date(folder.created_at).getTime()
                                        : Date.now();
                                    // @ts-ignore
                                    folderModel.updatedAt = folder.updated_at
                                        ? new Date(folder.updated_at).getTime()
                                        : folder.created_at
                                          ? new Date(folder.created_at).getTime()
                                          : Date.now();
                                    // @ts-ignore
                                    folderModel.last_page_added_at = folder.last_page_added_at
                                        ? new Date(folder.last_page_added_at).getTime()
                                        : null;
                                    // @ts-ignore
                                    folderModel.user_id = folder.user_id;
                                });
                                acc.push(newFolder);
                            }
                            return acc;
                        }, []);

                        syncLogger(
                            '중복 체크 후 폴더 데이터베이스에 batch insert/update 기능 실행',
                            {
                                batchLength: folderBatch.length,
                            }
                        );

                        await database.batch(...folderBatch);
                        foldersCount += folderBatch.length;
                    }

                    foldersSynced = true;
                    syncLogger('폴더 동기화 완료', { foldersCount });
                }

                // 알람 데이터 처리 (첫 번째 배치에서만)
                if (!alarmsSynced && alarms.length > 0) {
                    const alarmCollection = database.collections.get('alarm');

                    if (shouldSkipDuplicateCheck) {
                        // 중복 체크 없이 모든 알람 생성
                        const alarmBatch = alarms.map((alarm: any) => {
                            return alarmCollection.prepareCreate((alarmModel) => {
                                alarmModel._raw.id = alarm.id;

                                // @ts-ignore
                                alarmModel.user_id = alarm.user_id;
                                // @ts-ignore
                                alarmModel.page_id = alarm.page_id;
                                // @ts-ignore
                                alarmModel.next_alarm_time = alarm.next_alarm_time
                                    ? new Date(alarm.next_alarm_time).getTime()
                                    : null;
                                // @ts-ignore
                                alarmModel.sent_count = alarm.sent_count;
                                // @ts-ignore
                                alarmModel.last_notification_id = alarm.last_notification_id || '';
                                // @ts-ignore
                                alarmModel.createdAt = alarm.created_at
                                    ? new Date(alarm.created_at).getTime()
                                    : Date.now();
                                // @ts-ignore
                                alarmModel.updatedAt = alarm.updated_at
                                    ? new Date(alarm.updated_at).getTime()
                                    : alarm.created_at
                                      ? new Date(alarm.created_at).getTime()
                                      : Date.now();
                            });
                        });

                        syncLogger('중복 체크 없이 알람 데이터베이스에 batch insert 기능 실행', {
                            batchLength: alarmBatch.length,
                        });

                        await database.batch(...alarmBatch);
                        alarmsCount += alarmBatch.length;
                    } else {
                        // 중복 체크 후 알람 생성/업데이트
                        const existingAlarms = await alarmCollection
                            .query(
                                Q.where(
                                    'id',
                                    Q.oneOf(alarms.map((alarm: { id: string }) => alarm.id))
                                )
                            )
                            .fetch();

                        const existingAlarmsMap = new Map(
                            existingAlarms.map((alarm) => [alarm.id, alarm])
                        );

                        const alarmBatch = alarms.reduce((acc: Model[], alarm: any) => {
                            if (existingAlarmsMap.has(alarm.id)) {
                                syncLogger(
                                    '이미 존재하는 alarm',
                                    alarm.id,
                                    '기존의 데이터를 업데이트 합니다.'
                                );
                                // Alarm exists - prepare update operation
                                const existingAlarm = existingAlarmsMap.get(alarm.id);
                                const updatedAlarm = existingAlarm?.prepareUpdate((alarmModel) => {
                                    // @ts-ignore
                                    alarmModel.user_id = alarm.user_id;
                                    // @ts-ignore
                                    alarmModel.page_id = alarm.page_id;
                                    // @ts-ignore
                                    alarmModel.next_alarm_time = alarm.next_alarm_time
                                        ? new Date(alarm.next_alarm_time).getTime()
                                        : null;
                                    // @ts-ignore
                                    alarmModel.sent_count = alarm.sent_count;
                                    // @ts-ignore
                                    alarmModel.last_notification_id =
                                        alarm.last_notification_id || '';
                                    // @ts-ignore
                                    alarmModel.updatedAt = alarm.updated_at
                                        ? new Date(alarm.updated_at).getTime()
                                        : // @ts-ignore
                                          alarmModel.updatedAt;
                                });
                                if (updatedAlarm) {
                                    acc.push(updatedAlarm);
                                }
                            } else {
                                // Alarm does not exist - prepare create operation
                                const newAlarm = alarmCollection.prepareCreate((alarmModel) => {
                                    alarmModel._raw.id = alarm.id;

                                    // @ts-ignore
                                    alarmModel.user_id = alarm.user_id;
                                    // @ts-ignore
                                    alarmModel.page_id = alarm.page_id;
                                    // @ts-ignore
                                    alarmModel.next_alarm_time = alarm.next_alarm_time
                                        ? new Date(alarm.next_alarm_time).getTime()
                                        : null;
                                    // @ts-ignore
                                    alarmModel.sent_count = alarm.sent_count;
                                    // @ts-ignore
                                    alarmModel.last_notification_id =
                                        alarm.last_notification_id || '';
                                    // @ts-ignore
                                    alarmModel.createdAt = alarm.created_at
                                        ? new Date(alarm.created_at).getTime()
                                        : Date.now();
                                    // @ts-ignore
                                    alarmModel.updatedAt = alarm.updated_at
                                        ? new Date(alarm.updated_at).getTime()
                                        : alarm.created_at
                                          ? new Date(alarm.created_at).getTime()
                                          : Date.now();
                                });
                                acc.push(newAlarm);
                            }
                            return acc;
                        }, []);

                        syncLogger(
                            '중복 체크 후 알람 데이터베이스에 batch insert/update 기능 실행',
                            {
                                batchLength: alarmBatch.length,
                            }
                        );

                        await database.batch(...alarmBatch);
                        alarmsCount += alarmBatch.length;
                    }

                    alarmsSynced = true;
                    syncLogger('알람 동기화 완료', { alarmsCount });
                }

                // 페이지 데이터 처리
                if (shouldSkipDuplicateCheck) {
                    // 데이터가 없는 경우 - 중복 체크 없이 모든 페이지를 생성
                    const batch = pages.map((page: any) => {
                        return pageCollection.prepareCreate((pageModel) => {
                            pageModel._raw.id = page.id;
                            // @ts-ignore
                            pageModel.title = page.title;
                            // @ts-ignore
                            pageModel.body = page.body;
                            // @ts-ignore
                            pageModel.is_public = page.is_public;
                            // @ts-ignore
                            pageModel.length = page.length;
                            // @ts-ignore
                            pageModel.img_url = page.img_url;
                            // @ts-ignore
                            pageModel.createdAt = page.created_at
                                ? new Date(page.created_at).getTime()
                                : Date.now();
                            // @ts-ignore
                            pageModel.updatedAt = page.updated_at
                                ? new Date(page.updated_at).getTime()
                                : page.created_at
                                  ? new Date(page.created_at).getTime()
                                  : Date.now();
                            // @ts-ignore
                            pageModel.user_id = page.user_id;
                            // @ts-ignore
                            pageModel.type = page.type;
                            // @ts-ignore
                            pageModel.folder_id = page.folder_id;
                        });
                    });

                    syncLogger('중복 체크 없이 데이터베이스에 batch insert 기능 실행', {
                        batchLength: batch.length,
                    });

                    await database.batch(...batch);
                    pullCount += batch.length;
                } else {
                    // 데이터가 있는 경우 - 기존 방식대로 중복 체크 후 생성/업데이트
                    const existingPages = await pageCollection
                        .query(Q.where('id', Q.oneOf(pages.map((page: { id: string }) => page.id))))
                        .fetch();

                    const existingPagesMap = new Map(existingPages.map((page) => [page.id, page]));

                    const batch = pages.reduce((acc: Model[], page: any) => {
                        if (existingPagesMap.has(page.id)) {
                            syncLogger(
                                '이미 존재하는 page',
                                page.id,
                                '기존의 데이터를 업데이트 합니다.'
                            );
                            // Page exists - prepare update operation
                            const existingPage = existingPagesMap.get(page.id);
                            const updatedPage = existingPage?.prepareUpdate((pageModel) => {
                                // @ts-ignore
                                pageModel.title = page.title;
                                // @ts-ignore
                                pageModel.body = page.body;
                                // @ts-ignore
                                pageModel.is_public = page.is_public;
                                // @ts-ignore
                                pageModel.length = page.length;
                                // @ts-ignore
                                pageModel.img_url = page.img_url;
                                // @ts-ignore
                                pageModel.updatedAt = page.updated_at
                                    ? new Date(page.updated_at).getTime()
                                    : // @ts-ignore
                                      pageModel.updatedAt;
                                // @ts-ignore
                                pageModel.user_id = page.user_id;
                                // @ts-ignore
                                pageModel.type = page.type;
                                // @ts-ignore
                                pageModel.folder_id = page.folder_id;
                            });
                            if (updatedPage) {
                                acc.push(updatedPage);
                            }
                        } else {
                            // Page does not exist - prepare create operation
                            const newPage = pageCollection.prepareCreate((pageModel) => {
                                pageModel._raw.id = page.id;
                                // @ts-ignore
                                pageModel.title = page.title;
                                // @ts-ignore
                                pageModel.body = page.body;
                                // @ts-ignore
                                pageModel.is_public = page.is_public;
                                // @ts-ignore
                                pageModel.length = page.length;
                                // @ts-ignore
                                pageModel.img_url = page.img_url;
                                // @ts-ignore
                                pageModel.createdAt = page.created_at
                                    ? new Date(page.created_at).getTime()
                                    : Date.now();
                                // @ts-ignore
                                pageModel.updatedAt = page.updated_at
                                    ? new Date(page.updated_at).getTime()
                                    : page.created_at
                                      ? new Date(page.created_at).getTime()
                                      : Date.now();
                                // @ts-ignore
                                pageModel.user_id = page.user_id;
                                // @ts-ignore
                                pageModel.type = page.type;
                                // @ts-ignore
                                pageModel.folder_id = page.folder_id;
                            });
                            acc.push(newPage);
                        }
                        return acc;
                    }, []);

                    syncLogger('중복 체크 후 데이터베이스에 batch insert/update 기능 실행', {
                        batchLength: batch.length,
                    });

                    await database.batch(...batch);
                    pullCount += batch.length;
                }
            } catch (error) {
                // 오류 처리
                Sentry.captureException(error, {
                    tags: { type: 'sync' },
                    extra: {
                        comment: '최초 동기화 중 오류 발생',
                        batchSize: pages.length,
                        foldersSize: folders.length,
                        alarmsSize: alarms.length,
                        shouldSkipDuplicateCheck,
                    },
                });
                syncLogger('pullChangesForInitialSync error during batch operation', error);
            }
        });

        // 데이터베이스 쓰기 시간 측정 종료
        const dbWriteEndTime = performance.now();
        const dbWriteTime = dbWriteEndTime - dbWriteStartTime;

        // 배치 처리 시간 측정 종료
        const batchEndTime = performance.now();
        const batchTime = batchEndTime - batchStartTime;

        batchCount++;
        // 메모리 사용량 최소화를 위해 최근 5개 배치만 유지
        if (batchPerformance.length >= 5) {
            batchPerformance.shift(); // 가장 오래된 배치 정보 제거
        }

        batchPerformance.push({
            batchNumber: batchCount,
            batchSize: pages.length,
            foldersSize: foldersSynced ? folders.length : 0,
            alarmsSize: alarmsSynced ? alarms.length : 0,
            totalBatchTimeMs: batchTime.toFixed(2),
            dbWriteTimeMs: dbWriteTime.toFixed(2),
            itemsPerSecond: ((pages.length / batchTime) * 1000).toFixed(2),
            skipDuplicateCheck: shouldSkipDuplicateCheck,
        });

        syncLogger(`배치 #${batchCount} 성능 측정:`, {
            batchSize: pages.length,
            foldersSize: foldersSynced ? folders.length : 0,
            alarmsSize: alarmsSynced ? alarms.length : 0,
            totalBatchTimeMs: batchTime.toFixed(2),
            dbWriteTimeMs: dbWriteTime.toFixed(2),
            itemsPerSecond: ((pages.length / batchTime) * 1000).toFixed(2),
            skipDuplicateCheck: shouldSkipDuplicateCheck,
        });

        if (pages.length > 0) {
            onProgress(truncateText(pages[pages.length - 1].title, 10));
        }
    }

    // 전체 시간 측정 종료
    const totalEndTime = performance.now();
    const totalTime = totalEndTime - totalStartTime;

    // 성능 요약 로깅 (요약 정보만 저장하여 메모리 사용량 최소화)
    const performanceSummary = {
        totalTimeMs: totalTime.toFixed(2),
        totalTimeSeconds: (totalTime / 1000).toFixed(2),
        itemsProcessed: pullCount,
        foldersProcessed: foldersCount,
        alarmsProcessed: alarmsCount,
        batchesProcessed: batchCount,
        averageItemsPerSecond: ((pullCount / totalTime) * 1000).toFixed(2),
        skipDuplicateCheck: shouldSkipDuplicateCheck,
        // 전체 배치 데이터 대신 요약 정보만 포함
        recentBatches: batchPerformance.slice(-3), // 최근 3개 배치만 포함
    };

    syncLogger('초기 동기화 성능 요약:', performanceSummary);

    // 최초 동기화의 타임스탬프는 수집한 모든 데이터의 max(updated_at)을 사용
    // 이렇게 하면 증분 동기화에서 이미 받은 데이터를 중복으로 받지 않음
    const finalTimestampBase =
        maxUpdatedAtMs > 0
            ? maxUpdatedAtMs
            : lastCreatedAt
              ? new Date(lastCreatedAt).getTime()
              : Date.now();
    // 마이크로초 정밀도 차이(서버 > 클라 ms)로 인한 경계 재포함 방지를 위해 +1ms 오프셋 적용
    const finalTimestamp = finalTimestampBase + 1;

    syncLogger('최초 동기화 타임스탬프 결정', {
        maxUpdatedAtMs: maxUpdatedAtMs > 0 ? new Date(maxUpdatedAtMs).toISOString() : 'N/A (0)',
        lastCreatedAt: lastCreatedAt || 'N/A (null)',
        finalTimestampBase: new Date(finalTimestampBase).toISOString(),
        appliedOffsetMs: 1,
        finalTimestamp: new Date(finalTimestamp).toISOString(),
        reason:
            maxUpdatedAtMs > 0
                ? 'max(updated_at) 사용'
                : lastCreatedAt
                  ? 'lastCreatedAt 폴백'
                  : 'Date.now() 폴백',
    });

    const result = {
        changes: {
            page: { created: [], updated: [], deleted: [] },
            folder: { created: [], updated: [], deleted: [] },
            alarm: { created: [], updated: [], deleted: [] },
        },
        timestamp: finalTimestamp,
        pullCount: pullCount + foldersCount + alarmsCount,
        startPulledAt: lastPulledAt,
        performance: {
            totalTimeMs: totalTime.toFixed(2),
            totalItems: pullCount,
            totalFolders: foldersCount,
            totalAlarms: alarmsCount,
            batches: batchCount,
            skipDuplicateCheck: shouldSkipDuplicateCheck,
        },
    };

    syncLogger('pullChangesForInitialSync result', result);
    onProgress('');
    Sentry.addBreadcrumb({
        category: 'sync',
        message: 'pullChangesForInitialSync end',
        level: 'info',
        data: {
            timestamp,
            pullCount: pullCount + foldersCount + alarmsCount,
            pagesCount: pullCount,
            foldersCount: foldersCount,
            alarmsCount: alarmsCount,
            startPulledAt: lastPulledAt,
            performance: result.performance,
        },
    });
    return result;
}

export async function sum() {
    return false;
}
