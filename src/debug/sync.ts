/**
 * 동기화 관련 디버그 로거
 *
 * @description WatermelonDB와 Supabase 간 데이터 동기화 과정을 디버깅할 때 사용합니다.
 * 풀/푸시 동기화, 충돌 해결, 증분 동기화 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'sync'
 *
 * // 서버에서 활성화
 * DEBUG='sync' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const syncLogger = debug('sync');
syncLogger.log = console.log.bind(console);
