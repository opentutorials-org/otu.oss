/**
 * 리마인더 관련 디버그 로거
 *
 * @description 리마인더 알림 스케줄링 및 발송 과정을 디버깅할 때 사용합니다.
 * 리마인더 등록, 트리거, 알림 발송 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'reminder'
 *
 * // 서버에서 활성화
 * DEBUG='reminder' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const reminderLogger = debug('reminder');
reminderLogger.log = console.log.bind(console);
