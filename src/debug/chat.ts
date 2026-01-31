/**
 * AI 채팅 관련 디버그 로거
 *
 * @description AI 채팅 요청/응답 및 RAG 참조 문서 처리 과정을 디버깅할 때 사용합니다.
 * 사용자 질문, AI 응답, 컨텍스트 문서 선택 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'chat'
 *
 * // 서버에서 활성화
 * DEBUG='chat' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const chatLogger = debug('chat');
chatLogger.log = console.log.bind(console);
