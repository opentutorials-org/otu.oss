/**
 * 인증 관련 디버그 로거
 *
 * @description 인증 플로우(로그인, 로그아웃, 세션 관리)를 디버깅할 때 사용합니다.
 * OAuth 인증, 세션 갱신, 토큰 검증 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'auth'
 *
 * // 서버에서 활성화
 * DEBUG='auth' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const authLogger = debug('auth');
authLogger.log = console.log.bind(console);
