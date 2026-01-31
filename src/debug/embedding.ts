/**
 * 임베딩 관련 디버그 로거
 *
 * @description 문서 임베딩 생성 및 벡터 검색 과정을 디버깅할 때 사용합니다.
 * 텍스트 임베딩 변환, 유사도 검색, RAG 컨텍스트 구성 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'embedding'
 *
 * // 서버에서 활성화
 * DEBUG='embedding' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const embeddingLogger = debug('embedding');
embeddingLogger.log = console.log.bind(console);
