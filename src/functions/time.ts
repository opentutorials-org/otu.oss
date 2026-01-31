/**
 * (시, 분, 초) 정보를 받아서 ISO 8601 형식의 시간 문자열(`HH:mm:ss±HH:mm`)로 만들어줘.
 *
 * @param {number} hour - 시 (0~23).
 * @param {number} minute - 분 (0~59).
 * @param {number} second - 초 (0~59).
 * @param {number} [timezoneOffset] - UTC 기준 분 단위 오프셋. 지정 안 하면 로컬 타임존을 사용해.
 * @returns {string} 시간만 포함된 ISO 8601 문자열(`HH:mm:ss±HH:mm`).
 */
export function generateISO8601Time(
    hour: number,
    minute: number,
    second: number,
    timezoneOffset?: number
): string {
    // 시스템의 로컬 타임존 오프셋(분)을 가져옴
    const localTimezoneOffset = -new Date().getTimezoneOffset();
    // 만약 timezoneOffset이 있으면 사용, 없으면 localTimezoneOffset 사용
    const effectiveOffset = timezoneOffset ?? localTimezoneOffset;

    const pad = (value: number): string => String(value).padStart(2, '0');

    // 분 단위 오프셋을 시와 분으로 분리
    const offsetHours = Math.floor(Math.abs(effectiveOffset) / 60);
    const offsetMinutes = Math.abs(effectiveOffset) % 60;

    // 오프셋을 + 혹은 -로 구분해 문자열을 만든다.
    const timezoneString = `${effectiveOffset >= 0 ? '+' : '-'}${pad(offsetHours)}:${pad(offsetMinutes)}`;

    // 최종적으로 "HH:mm:ss±HH:mm" 형태의 문자열 반환
    return `${pad(hour)}:${pad(minute)}:${pad(second)}${timezoneString}`;
}

/**
 * ISO 8601 형식의 시간 문자열에서 시간을 추출하는 함수.
 * 이 함수는 전체 ISO 날짜-시간 문자열(e.g., "2025-01-27T08:00:00+09:00")과
 * 타임존 정보가 포함된 시간 문자열(e.g., "08:00:00+09") 모두 처리할 수 있다.
 *
 * @param isoTimeString - ISO 8601 형식의 시간 문자열.
 * @returns 숫자 형태의 시간(hour).
 * @throws 입력 문자열이 유효하지 않을 경우 오류를 발생시킨다.
 */
export function extractHourFromISOTime(isoTimeString: string): number {
    // 시간 부분 추출
    const timePart = isoTimeString.includes('T')
        ? isoTimeString.split('T')[1]?.split('+')[0] // 'T'가 포함된 경우 처리
        : isoTimeString.split('+')[0]; // 'T'가 없는 경우 처리

    if (!timePart) {
        throw new Error('유효하지 않은 ISO 시간 문자열입니다.');
    }

    // 시간 부분을 숫자로 변환하여 반환
    const hour = parseInt(timePart.split(':')[0], 10);
    return hour;
}
