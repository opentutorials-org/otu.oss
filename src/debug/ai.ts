/**
 * AI 서비스 관련 디버그 로거
 *
 * @description AI 서비스 호출 및 응답을 디버깅할 때 사용합니다.
 * OpenAI API 요청, 토큰 사용량, 응답 처리 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'ai'
 *
 * // 서버에서 활성화
 * DEBUG='ai' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const aiLogger = debug('ai');
aiLogger.log = console.log.bind(console);
