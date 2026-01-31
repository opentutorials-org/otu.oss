/**
 * 레이아웃 관련 상수 정의
 *
 * 전체 앱에서 일관된 레이아웃을 위한 상수들을 정의합니다.
 * 이 값들은 LoginedMain, Top, Bottom, SwipeableModal 등에서 공통으로 사용됩니다.
 */

// 컨텐츠 영역 최대 폭
export const MAX_CONTENT_WIDTH = '680px';

// Top 컴포넌트 로고 위치
export const TOP_LOGO_POSITION = {
    left: '19px',
    top: '39px',
} as const;

// Top 컴포넌트 높이
export const TOP_HEIGHT = '70px';

// Bottom 컴포넌트 높이 (safe area 제외)
export const BOTTOM_HEIGHT = '80px';

// 로고 크기
export const LOGO_SIZE = '43px';

// 반응형 패딩 클래스
export const RESPONSIVE_PADDING_CLASS = 'px-[19px] sm:px-[19px]';

// 컨텐츠 컨테이너 클래스
export const CONTENT_CONTAINER_CLASS = `w-full max-w-[${MAX_CONTENT_WIDTH}]`;

// 컨텐츠 영역 클래스 (패딩 포함)
export const CONTENT_AREA_CLASS = `${CONTENT_CONTAINER_CLASS} ${RESPONSIVE_PADDING_CLASS}`;
