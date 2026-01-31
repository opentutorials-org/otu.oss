//@ts-ignore
import debug from 'debug';

/**
 * Home2 리팩토링 전용 로거
 * React Router DOM 기반 네비게이션 및 SwipeableModal 동작 추적
 *
 * 사용법:
 * - 클라이언트: localStorage.debug = 'home2:*'
 * - 서버: DEBUG='home2:*'
 *
 * 로그 카테고리:
 * - home2:router - 라우트 변경 및 섹션 전환
 * - home2:modal - SwipeableDrawer 열기/닫기 동작
 * - home2:nav - 네비게이션 및 returnPath 처리
 * - home2:sync - 동기화 트리거 및 상태 업데이트
 * - home2:state - 상태 관리 및 URL 파싱
 */

export const home2RouterLogger = debug('home2:router');
export const homeModalLogger = debug('home2:modal');
export const home2NavLogger = debug('home2:nav');
export const home2SyncLogger = debug('home2:sync');
export const home2StateLogger = debug('home2:state');

// 로그 출력을 console.log로 바인딩
home2RouterLogger.log = console.log.bind(console);
homeModalLogger.log = console.log.bind(console);
home2NavLogger.log = console.log.bind(console);
home2SyncLogger.log = console.log.bind(console);
home2StateLogger.log = console.log.bind(console);

/**
 * 통합 home2 로거 - 모든 카테고리를 포함
 */
export const home2Logger = debug('home2');
home2Logger.log = console.log.bind(console);
