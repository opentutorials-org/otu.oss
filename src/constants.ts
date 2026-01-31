// z-index 계층 상수: 변경 중인 컴포넌트 범위 내에서 사용되는 값만 정의합니다.
// 전역 규칙: 새로운 z-index가 필요하면 여기에 추가하고, 숫자 하드코딩은 금지합니다.

export const Z_INDEX = {
    CONFIRM_DIALOG: 1500, // ConfirmDialog
    SNACKBAR: 1400, // Snackbar
    CHAT_DRAWER: 1240, // 채팅 드로어 (SwipeableDrawer)
    CONTROL_FLOATING: 1230, // 에디터 우측 하단 컨트롤 컨테이너
    PAGE_DETAIL_MODAL: 1220, // 페이지 상세 모달 (PageDetail)
    BOTTOM_BAR_BASE: 1210, // 일반 상태 하단 바
    FOLDER_DETAIL_PAGE_LIST_MODAL: 1200, // 폴더 상세 페이지 리스트 모달 (Section)
    MODAL_BASE: 1200, // 공통 SwipeableModal 기본값
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
