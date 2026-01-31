/**
 * 폴더 관련 디버그 로거
 *
 * @description 폴더 계층 구조 및 동기화 과정을 디버깅할 때 사용합니다.
 *
 * @example
 * // 클라이언트에서 활성화 (전체)
 * localStorage.debug = 'folder:*'
 *
 * // 서버에서 활성화 (전체)
 * DEBUG='folder:*' npm run dev
 *
 * 로그 카테고리:
 * - folder - 폴더 CRUD 작업
 * - folder:loading - 폴더 목록 로딩 상태
 * - folder:sync - 폴더 동기화 과정
 */
//@ts-ignore
import debug from 'debug';
export const folderLogger = debug('folder');
folderLogger.log = console.log.bind(console);

export const folderLoadingLogger = debug('folder:loading');
folderLoadingLogger.log = console.log.bind(console);

export const folderSyncLogger = debug('folder:sync');
folderSyncLogger.log = console.log.bind(console);
