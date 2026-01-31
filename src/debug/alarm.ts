/**
 * 알람 관련 디버그 로거
 *
 * @description 알람 생성, 수정, 삭제 과정을 디버깅할 때 사용합니다.
 * 알람 CRUD 작업, 스케줄링 상태 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'alarm'
 *
 * // 서버에서 활성화
 * DEBUG='alarm' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const alarmLogger = debug('alarm');
alarmLogger.log = console.log.bind(console);
