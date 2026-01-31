/**
 * 검색 관련 디버그 로거
 *
 * @description 전문 검색 쿼리 및 결과 처리 과정을 디버깅할 때 사용합니다.
 * 검색어 파싱, 인덱스 조회, 결과 정렬 등의 상세 로그를 확인할 수 있습니다.
 *
 * @example
 * // 클라이언트에서 활성화
 * localStorage.debug = 'search'
 *
 * // 서버에서 활성화
 * DEBUG='search' npm run dev
 */
//@ts-ignore
import debug from 'debug';
export const searchLogger = debug('search');
searchLogger.log = console.log.bind(console);
