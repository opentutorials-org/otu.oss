import * as Sentry from '@sentry/nextjs';

/**
 * 함수별 추적 데이터를 위한 인터페이스
 */
interface TrackerData {
    /** 마지막 함수 호출 시간 (타임스탬프) */
    lastCallTime: number;
    /** 연속 호출 횟수 */
    callCount: number;
    /** 카운터 리셋을 위한 타이머 ID */
    resetTimeoutId: NodeJS.Timeout | null;
    /** 이미 Sentry에 보고했는지 여부 (페이지 리로드 전까지) */
    hasReported: boolean;
}

// 함수별 추적 저장소 (키: 컴포넌트명:함수명)
const trackerMap: Record<string, TrackerData> = {};

// 설정값
const CALL_THRESHOLD = 10; // 5회 이상 호출되면 연속 호출로 간주
const TIME_THRESHOLD = 500; // 2초 이내에 호출되면 연속 호출로 간주

/**
 * 특정 함수에 대한 추적 데이터를 초기화하거나 가져옵니다.
 * @param key 추적 키 (일반적으로 '컴포넌트명:함수명' 형식)
 * @returns 해당 키에 대한 추적 데이터 객체
 */
function getTrackerData(key: string): TrackerData {
    if (!trackerMap[key]) {
        trackerMap[key] = {
            lastCallTime: 0,
            callCount: 0,
            resetTimeoutId: null,
            hasReported: false,
        };
    }
    return trackerMap[key];
}

/**
 * 함수의 연속 호출을 감지하고 임계값을 초과할 경우 Sentry에 보고합니다.
 * 한 번 보고한 후에는 페이지 리로드 전까지 더 이상 보고하지 않습니다.
 *
 * @param functionName - 추적할 함수 이름
 * @param componentName - 함수가 속한 컴포넌트 이름
 * @param extraData - Sentry 보고 시 포함할 추가 데이터 (선택 사항)
 * @returns 현재까지의 연속 호출 횟수
 *
 * @example
 * // 기본 사용법
 * const callCount = trackFunctionCall('fetchData', 'UserProfile');
 *
 * @example
 * // 추가 디버깅 정보 포함
 * const callCount = trackFunctionCall('fetchContents', 'LoginedMain', {
 *   pagination: pagination.page,
 *   searchKeyword: searchMethod.keyword,
 *   lastUpdateContentId: lastUpdateContentId
 * });
 */
export function trackFunctionCall(
    functionName: string,
    componentName: string,
    extraData?: Record<string, any>
) {
    const trackerKey = `${componentName}:${functionName}`;
    const tracker = getTrackerData(trackerKey);
    const now = Date.now();
    const timeSinceLastCall = now - tracker.lastCallTime;

    if (timeSinceLastCall < TIME_THRESHOLD) {
        tracker.callCount++;

        // 기존 리셋 타이머가 있으면 취소
        if (tracker.resetTimeoutId) {
            clearTimeout(tracker.resetTimeoutId);
        }

        // 임계값 초과 및 아직 보고하지 않은 경우에만 Sentry에 보고
        if (tracker.callCount >= CALL_THRESHOLD && !tracker.hasReported) {
            Sentry.captureMessage(`${functionName} 연속 호출 감지: ${tracker.callCount}회`, {
                level: 'warning',
                tags: {
                    component: componentName,
                    function: functionName,
                },
                extra: {
                    callCount: tracker.callCount,
                    trackerKey,
                    ...extraData,
                },
            });

            // 보고 완료 표시 (페이지 리로드 전까지 다시 보고하지 않음)
            tracker.hasReported = true;

            // 디버깅용 콘솔
            console.warn(`[!] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.warn(`[!] 중요: ${functionName} 함수 연속 호출 감지: ${tracker.callCount}회`);
            console.warn(`[!] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        }

        // 일정 시간 후 카운터 리셋
        tracker.resetTimeoutId = setTimeout(() => {
            tracker.callCount = 0;
            tracker.resetTimeoutId = null;
            // 주의: hasReported는 리셋하지 않음 (페이지 리로드 전까지 유지)
        }, TIME_THRESHOLD);
    } else {
        // 시간 간격이 충분하면 카운터 리셋
        tracker.callCount = 1;
    }

    // 마지막 호출 시간 업데이트
    tracker.lastCallTime = now;

    return tracker.callCount;
}
