import React from 'react';
import { contentType } from '@/types';
import { atom } from 'jotai';
import { atomWithImmer } from 'jotai-immer';
import { atomWithStorage } from 'jotai/utils';
import { Database } from '@/lib/database/types';
import { getSearchKeywordFromUrl } from '@/utils/navigation';
import { syncLogger } from '@/debug/sync';

export type finderAtomType = {
    mode: 'search' | 'ai' | null;
    inputMessage: string;
    ai: aiResponseType[];
    aiQueue: aiResponseQueueType;
};
export type aiResponseType = {
    id: number;
    referenceAll: aiReferenceType[];
    requestMessage: string;
    responseMessage: string;
    isModified?: boolean;
};
export type aiResponseQueueType = {
    status: '-1_PENDING' | '0_BEFORE_SIMILARITY' | '1_BEFORE_LLM_ASK' | '2_COMPLETE';
};
export type aiReferenceType = {
    id: number;
    content: string;
    metadata: {
        id: number;
        type: 'page' | 'book' | 'library';
        title: string;
    };
    similarity: number;
    selected: boolean;
};
export const chatOpenState = atomWithStorage('OTU_chat_open', false);
export const chatState = atomWithImmer<finderAtomType>({
    mode: 'ai',
    inputMessage: '',
    ai: [],
    aiQueue: { status: '-1_PENDING' },
});
// const [similarityResults] = atomsWithQuery((get) => ({
//   queryKey: ["similarity"],
//   queryFn: async ({ queryKey: [, id] }) => {
//     const res = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
//     return res.json();
//   },
// }));

// 타입 정의 부분
export enum PlanItemType {
    PROMPT = 'PROMPT',
    SIMILARITY = 'SIMILARITY',
    LLM_ASK = 'LLM_ASK',
}

export enum MessageType {
    Request = 'request',
    SimilarityResponseStart = 'similarity_response_start',
    SimilarityResponseEnd = 'similarity_response_end',
    SimilarityResponseEndNotFound = 'similarity_response_end_not_found',
    LLMResponse = 'llm_request',
}

export type Prompt_data = {
    message: string;
};

export type Similarity_data = {
    range: 'all' | 'current';
    query?: string;
    id?: string;
} & ({ range: 'all'; query: string; id?: never } | { range: 'current'; query: string; id: string });

export type similarityResponse = {
    id: string;
    content: string;
    metadata: {
        type: string;
        title: string;
    };
    similarity: number;
    page_id: string;
};

export type LLM_ask_data = {
    llm_id: 'openai' | 'cohere' | 'google';
    message: string;
    references: similarityResponse[];
    contextMessages: string[];
};

export type contextMessage = {
    role: 'user' | 'assistant';
    content: string;
};

// 리마인더 관련 타입 정의 (데이터 스키마는 alarm 테이블 유지)
export type ReminderPageData = {
    id: string;
    page_id: string;
    user_id: string;
    next_alarm_time: number;
    sent_count: number;
    last_notification_id: string;
    created_at: number;
    updated_at: number;
    // 페이지 정보 (JOIN 결과)
    page_title?: string;
    page_body?: string;
    page_created_at?: number;
    page_updated_at?: number;
    page_type?: 'text' | 'draw';
    page_folder_id?: string | null;
    page_img_url?: string | null;
};

export type askLLMContext = {
    message: string;
    references: similarityResponse[];
    history: contextMessage[];
    option: {
        ai: OptionItem | null;
        rag: string;
    };
};
export type OptionItem = {
    description: string;
    value: string;
    displayLabel: string;
    provider?: string;
};
export type PlanItem =
    | { type: PlanItemType.PROMPT; data: Prompt_data }
    | { type: PlanItemType.SIMILARITY; data: Similarity_data }
    | { type: PlanItemType.LLM_ASK; data: LLM_ask_data };

export type MessageItem = {
    id: string;
    type: MessageType;
    name: string;
    content: any;
};

// 양수 behavior: 'smooth', 음수 : none
export const chatScrollToBottomState = atom<number>(0);

// deprecated
export type chatSessionState = {
    inputMessage: string;
    messages: MessageItem[];
};

export const chatMessagesState = atomWithImmer<MessageItem[]>([]);

export const chatSessionInitial: chatSessionState = {
    inputMessage: '',
    messages: [],
};
// Jotai 상태 정의
export const chatSessionState = atomWithImmer<chatSessionState>(chatSessionInitial);

// 배타적 유니온 타입: pageId 또는 pageIds 중 하나만 사용 가능
export type RefreshPayload = {
    seed: string;
    action?: 'create' | 'update' | 'delete';
} & (
    | { pageId: string; pageIds?: never } // pageId만 사용
    | { pageIds: string[]; pageId?: never } // pageIds만 사용
    | { pageId?: never; pageIds?: never } // 둘 다 없음 (전체 갱신)
);

export const refreshSeedAfterContentUpdate = atom<RefreshPayload>({
    seed: 'initial',
});
type snackbarStateType = {
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
    autoHideDuration: number;
    horizontal: 'left' | 'center' | 'right';
    vertical: 'top' | 'bottom';
    actionBtn?: { label: string; onClick: () => void } | null;
};
const snackbarStateInit: snackbarStateType = {
    open: false,
    message: '',
    severity: 'info',
    autoHideDuration: 3000,
    horizontal: 'left',
    vertical: 'bottom',
    actionBtn: null,
};
export const snackbarState = atom<snackbarStateType>(snackbarStateInit);

export const openSnackbarState = atom(null, (get, set, update) => {
    // @ts-ignore
    set(snackbarState, { ...snackbarStateInit, ...update, open: true });
});

interface ConfirmStateType {
    open: boolean;
    message: string;
    onYes: (() => void) | false;
    onNo: (() => void) | null;
    yesLabel?: string;
    noLabel?: string;
    closeOnBackdropClick?: boolean;
    customContent?: React.ReactNode;
    fullscreen?: boolean;
}

export const confirmState = atom<ConfirmStateType>({
    open: false,
    message: '',
    onYes: false,
    onNo: null,
    yesLabel: '동의',
    noLabel: '취소',
    closeOnBackdropClick: true,
    fullscreen: false,
});

export const openConfirmState = atom(null, (_get, set, update: Partial<ConfirmStateType>) => {
    set(confirmState, {
        open: true,
        message: update.message || '',
        onYes: update.onYes || false,
        onNo: update.onNo || null,
        yesLabel: update.yesLabel || '동의',
        noLabel: update.noLabel || '취소',
        closeOnBackdropClick:
            update.closeOnBackdropClick !== undefined ? update.closeOnBackdropClick : true,
        customContent: update.customContent || null,
        fullscreen: update.fullscreen || false,
    });
});

export const closeConfirmState = atom(null, (get, set) => {
    const data = get(confirmState);
    set(confirmState, { ...data, open: false });
});

// themeModeState: Uses atomWithStorage with default SSR-safe behavior
// During SSR and initial render: uses 'gray' default value
// After hydration: automatically loads from localStorage
export const themeModeState = atomWithStorage<'gray' | 'white' | 'black'>(
    'themeMode',
    'gray' // SSR-safe default value
);

// themeModeState에서 파생된 다크모드 여부 (읽기 전용)
export const isDarkModeAtom = atom((get) => get(themeModeState) === 'black');

// @deprecated : RRD의 path를 기반으로 검색어를 추론하도록 변경합니다.
type initSearchMethodType = {
    keyword: string | string[];
    start: string;
    end: string;
    sortingKey: string;
    sortCriteria: 'asc' | 'desc';
};
// @deprecated : RRD의 path를 기반으로 검색어를 추론하도록 변경합니다.
export const initSearchMethod = {
    keyword: '',
    start: '',
    end: '',
    sortingKey: 'created_at',
    sortCriteria: 'desc' as 'asc' | 'desc',
};
/**
 * @deprecated : RRD의 path를 기반으로 검색어를 추론하도록 변경합니다.
 */
export const searchMethodState = atomWithImmer<initSearchMethodType>(initSearchMethod);

/**
 * @deprecated : RRD의 path를 기반으로 검색어를 추론하도록 변경합니다.
 */
const initSearchDialog = {
    displayValue: '',
    open: false,
    isLoading: false,
};
/**
 * @deprecated : RRD의 path를 기반으로 검색어를 추론하도록 변경합니다.
 */
export const searchDialogState = atom(initSearchDialog);

/**
 * @deprecated : RRD의 path를 기반으로 검색어를 추론하도록 변경합니다.
 */
export const resetSearchState = atom(null, (get, set) => {
    set(searchMethodState, (draft) => {
        return initSearchMethod;
    });
    set(searchDialogState, { ...initSearchDialog });
});

export const scrollTopRandomState = atom(0);
export const scrollToTopState = atom(null, (get, set, update) => {
    set(scrollTopRandomState, Math.random());
});

export const mainScrollPaneState = atom<HTMLDivElement | null>(null);

export const displayModeState = atomWithStorage<'GRID' | 'LIST'>('displayMode', 'GRID');

/**
 * @deprecated RRD 표준 훅(`useLocation`, `useParams`) 사용으로 대체됩니다.
 * URL 직접 파싱 대신 React Router를 사용하세요.
 */
export const currentPagePathToType = (path: string): currentPageType => {
    if (path === '/home/create/page') return { type: 'PAGE_CREATE', id: null, path };
    if (path === '/home/setting') return { type: 'SETTING', id: null, path };
    if (path.startsWith('/home/page/')) {
        const id = path.split('/')[3]; // 경로에서 ID 추출
        const pageState: currentPageType = { type: 'PAGE_EDIT', id, path };
        const searchKeywordFromUrl = getSearchKeywordFromUrl();
        if (searchKeywordFromUrl) {
            pageState.extraData = { searchKeyword: searchKeywordFromUrl };
        }
        return pageState;
    }
    if (path.startsWith('/home/folder/')) {
        const segments = path.split('/');
        if (segments.length >= 4 && segments[3]) {
            // /home/folder/[id] 형태
            const folderId = segments[3];
            return { type: 'FOLDER', id: folderId, path };
        } else {
            // /home/folder 형태 (폴더 목록) - 제거됨, 홈으로 처리
            return { type: 'HOME', id: null, path: '/' };
        }
    }
    if (path === '/home/folder') {
        // /home/folder 형태 (폴더 목록 모드)
        return { type: 'FOLDER_LIST', id: null, path };
    }
    if (path === '/home/reminder') {
        // /home/reminder 형태 (리마인더 목록 모드)
        return { type: 'REMINDER_LIST', id: null, path };
    }
    if (path.startsWith('/home/search')) {
        // URL query parameter에서 검색어 추출
        try {
            const url = new URL(path, 'http://localhost');
            const searchKeyword = url.searchParams.get('searchKeyword');
            return { type: 'SEARCH', id: searchKeyword, path };
        } catch {
            // URL 파싱 실패 시 기본 검색 페이지
            return { type: 'SEARCH', id: null, path };
        }
    }
    return { type: 'HOME', id: null, path: '/' };
};

export type currentPageType = {
    type:
        | 'HOME'
        | 'PAGE_READ'
        | 'PAGE_CREATE'
        | 'PAGE_EDIT'
        | 'SETTING'
        | 'SEARCH'
        | 'DRAW'
        | 'FOLDER'
        | 'FOLDER_LIST'
        | 'REMINDER_LIST'
        | 'PAGE_LIST';
    id: string | null;
    path: string;
    extraData?: {
        searchKeyword?: string;
        folderName?: string;
    };
    from?: '/home/reminder';
};
/**
 * @deprecated URL 기반 상태 관리로 전환합니다. 사용처에서 제거 진행 중입니다.
 */
export const currentPageState = atomWithImmer<currentPageType>({
    type: 'HOME',
    id: null,
    path: '/',
});
export const settingState = atom({
    open: false,
});
export const syncingState = atom(false);
export const runSyncIdState = atom(0);
export const runSyncState = atom(null, (get, set, update) => {
    syncLogger('runSyncState', { update });
    set(runSyncIdState, get(runSyncIdState) + 1);
});
export const syncResultState = atom<{
    pullCount: number;
    pullItems: {
        page: { created: any[]; updated: any[]; deleted: any[] };
        folder: { created: any[]; updated: any[]; deleted: any[] };
        alarm: { created: any[]; updated: any[]; deleted: any[] };
    };
    pushCount: number;
    pushItems: {
        page: { created: any[]; updated: any[]; deleted: any[] };
        folder: { created: any[]; updated: any[]; deleted: any[] };
        alarm: { created: any[]; updated: any[]; deleted: any[] };
    };
    totalCount: number;
    startPulledAt: any;
} | null>(null);
export const noticeHistoryState = atomWithStorage('noticeHistory', {
    isOfflineUserFirstWrite: true,
    isOfflineUserFirstCamera: true,
    isIOSEnterProblem: true,
});
export const contentListMessageState = atom<string>('');
type focusGlobalInputType = {
    mode: 'page' | 'search';
    seed: number;
};
export const focusGlobalInputRandomState = atom<focusGlobalInputType>({
    mode: 'page',
    seed: 0,
});
export const focusGlobalInputState = atom(null, (get, set, update: 'page' | 'search') => {
    set(focusGlobalInputRandomState, { mode: update, seed: Math.random() });
});
export const globalBackDropState = atom(false);
export const isModifiedState = atom(false);
export const loginedMenuAnchorState = atom<null | HTMLElement>(null);
export const fileUploaderOpenState = atom(false);

export const selectedItemsState = atom<Set<string>>(new Set<string>());
export const toggleItemSelection = atom(null, (get, set, itemId: string) => {
    const selectedItems = new Set(get(selectedItemsState));
    if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
    } else {
        selectedItems.add(itemId);
    }
    set(selectedItemsState, selectedItems);
});
export const selectionModeState = atom<boolean>(false);

// 다중 선택 모드를 취소하는 유틸리티 함수
export const resetSelectionState = atom(null, (get, set) => {
    set(selectionModeState, false);
    set(selectedItemsState, new Set<string>());
});

export const openFileUploaderState = atom(null, (get, set, update: { open: boolean }) => {
    set(fileUploaderOpenState, update.open);
});

export const drawerWidthState = atomWithStorage('OTU_drawer_width', 300);

const initProfileDialog = {
    displayValue: '',
    open: false,
    isLoading: false,
};
export const profileDialogState = atom<typeof initProfileDialog>(initProfileDialog);

export const profileUpdateState = atom<number>(0);

// 현재 페이지의 제목과 본문을 업데이트하기 위한 atom
export type currentPageContentType = {
    id: string | null;
    title: string | null;
    body: string | null;
    updateTime: number;
};

export const currentPageContentState = atom<currentPageContentType>({
    id: null,
    title: null,
    body: null,
    updateTime: Date.now(),
});

// 현재 페이지 콘텐츠를 업데이트하는 액션 atom
export const updateCurrentPageContentState = atom(
    null,
    (get, set, update: Partial<currentPageContentType>) => {
        const current = get(currentPageContentState);
        set(currentPageContentState, {
            ...current,
            ...update,
            updateTime: Date.now(),
        });
    }
);

export const isTitleLoadingState = atom<boolean>(false);

export const setIsTitleLoadingState = atom(null, (get, set, update: boolean) => {
    set(isTitleLoadingState, update);
});

// 현재 에디터 인스턴스를 관리하기 위한 atom
export type editorUploaderContextType = {
    editor: any | null;
    mode: 'page_creation' | 'editor_insert' | null;
};

// 에디터 컨텍스트를 저장하는 atom
export const editorUploaderContextState = atom<editorUploaderContextType>({
    editor: null,
    mode: null,
});

// 파일 업로더 열기 함수의 확장 버전 (에디터 컨텍스트 포함)
export const openFileUploaderWithEditorState = atom(
    null,
    (get, set, update: { open: boolean; editorContext?: editorUploaderContextType }) => {
        set(fileUploaderOpenState, update.open);
        if (update.editorContext) {
            set(editorUploaderContextState, update.editorContext);
        } else if (!update.open) {
            // 업로더를 닫을 때 컨텍스트 초기화
            set(editorUploaderContextState, { editor: null, mode: null });
        }
    }
);

// 폴더 관리 다이얼로그 상태
export type folderManagementDialogType = {
    open: boolean;
    currentPageId?: string;
    currentFolderId?: string;
    autoCreateMode?: boolean;
    multiplePageIds?: string[]; // 다중 페이지 선택 시 사용
};

const initFolderManagementDialog: folderManagementDialogType = {
    open: false,
    currentPageId: undefined,
    currentFolderId: undefined,
    autoCreateMode: false,
};

export const folderManagementDialogState = atom<folderManagementDialogType>(
    initFolderManagementDialog
);

// 폴더 관리 다이얼로그 열기
export const openFolderManagementDialogState = atom(
    null,
    (
        get,
        set,
        update: {
            currentPageId?: string;
            currentFolderId?: string;
            autoCreateMode?: boolean;
            multiplePageIds?: string[];
        }
    ) => {
        set(folderManagementDialogState, {
            open: true,
            currentPageId: update.currentPageId,
            currentFolderId: update.currentFolderId,
            autoCreateMode: update.autoCreateMode,
            multiplePageIds: update.multiplePageIds,
        });
    }
);

// 폴더 관리 다이얼로그 닫기
export const closeFolderManagementDialogState = atom(null, (get, set) => {
    set(folderManagementDialogState, {
        open: false,
        currentPageId: undefined,
        currentFolderId: undefined,
        autoCreateMode: false,
        multiplePageIds: undefined,
    });
});

// 폴더 생성 다이얼로그 상태
export type folderCreationDialogType = {
    open: boolean;
    targetFolderId?: string; // 이미 생성된 폴더가 있는 경우 해당 폴더로 이동
    onSuccess?: (folderId: string) => void; // 폴더 생성 성공 시 콜백
};

const initFolderCreationDialog: folderCreationDialogType = {
    open: false,
    targetFolderId: undefined,
    onSuccess: undefined,
};

export const folderCreationDialogState = atom<folderCreationDialogType>(initFolderCreationDialog);

// 폴더 생성 다이얼로그 열기
export const openFolderCreationDialogState = atom(
    null,
    (get, set, update: { targetFolderId?: string; onSuccess?: (folderId: string) => void }) => {
        set(folderCreationDialogState, {
            open: true,
            targetFolderId: update.targetFolderId,
            onSuccess: update.onSuccess,
        });
    }
);

// 폴더 생성 다이얼로그 닫기
export const closeFolderCreationDialogState = atom(null, (get, set) => {
    const current = get(folderCreationDialogState);
    set(folderCreationDialogState, {
        ...current,
        open: false,
    });
});

// refreshListState 파라미터 타입 정의
type RefreshListPayload = {
    source: string;
    action?: 'create' | 'update' | 'delete';
} & (
    | { pageId: string; pageIds?: never }
    | { pageIds: string[]; pageId?: never }
    | { pageId?: never; pageIds?: never }
);

export const refreshListState = atom(null, (get, set, payload: RefreshListPayload) => {
    // 로그 추가를 위한 동적 import
    if (typeof window !== 'undefined') {
        import('@/debug/refresh').then(({ refreshLogger }) => {
            refreshLogger('refreshListState 호출됨', payload);
        });
    }

    // 새로운 방식: 외과수술적 업데이트
    // 배타적 유니온 타입이므로 조건에 따라 올바른 타입의 객체를 한 번에 생성
    const refreshPayload: RefreshPayload = payload.pageId
        ? {
              seed: `${payload.source}-${Date.now()}`,
              pageId: payload.pageId,
              action: payload.action,
          }
        : payload.pageIds
          ? {
                seed: `${payload.source}-${Date.now()}`,
                pageIds: payload.pageIds,
                action: payload.action,
            }
          : {
                seed: `${payload.source}-${Date.now()}`,
                action: payload.action,
            };

    set(refreshSeedAfterContentUpdate, refreshPayload);

    if (typeof window !== 'undefined') {
        import('@/debug/refresh').then(({ refreshLogger }) => {
            refreshLogger('글목록 갱신 실행됨', { payload });
        });
    }
});

// 폴더 관련 상태
export const foldersDataState = atom<any[]>([]);

// 폴더명 조회 헬퍼
export const getFolderNameByIdState = atom((get) => (folderId: string | null | undefined) => {
    if (!folderId) return null;
    const folders = get(foldersDataState);
    const folder = folders.find((f) => f.id === folderId);
    return folder?.name || null;
});

// 폴더 데이터 새로고침 트리거
export const refreshFoldersState = atom(0);

// sync 완료 시에만 컨텐츠 리프레시를 위한 전용 상태
export const syncCompletedRefreshState = atom<string>('initial');

// sync 완료 시 컨텐츠 리프레시 트리거
export const triggerSyncCompletedRefresh = atom(null, (get, set, id: string) => {
    if (typeof window !== 'undefined') {
        import('@/debug/sync').then(({ syncLogger }) => {
            syncLogger('triggerSyncCompletedRefresh 호출됨', { id });
        });
    }
    set(syncCompletedRefreshState, id);
});

if (process.env.NODE_ENV !== 'production') {
    chatState.debugLabel = 'searchAtom';
    chatSessionState.debugLabel = 'chatSessionAtom';
    chatMessagesState.debugLabel = 'chatMessagesAtom';
    refreshSeedAfterContentUpdate.debugLabel = 'refreshSeedAfterContentUpdate';
    snackbarState.debugLabel = 'snackbarState';
    openSnackbarState.debugLabel = 'openSnackbarState';
    themeModeState.debugLabel = 'themeModeState';
    isDarkModeAtom.debugLabel = 'isDarkModeAtom';
    searchMethodState.debugLabel = 'searchMethodState';
    searchDialogState.debugLabel = 'searchDialogState';
    displayModeState.debugLabel = 'displayMode';
    syncingState.debugLabel = 'syncing';
    mainScrollPaneState.debugLabel = 'mainScrollPaneState';
    currentPageState.debugLabel = 'currentPageState';
    currentPageContentState.debugLabel = 'currentPageContentState';
    updateCurrentPageContentState.debugLabel = 'updateCurrentPageContentState';
    scrollToTopState.debugLabel = 'scrollToTopState';
    confirmState.debugLabel = 'confirmState';
    openConfirmState.debugLabel = 'openConfirmState';
    closeConfirmState.debugLabel = 'closeConfirmState';
    scrollTopRandomState.debugLabel = 'scrollTopRandomState';
    runSyncState.debugLabel = 'runSyncState';
    runSyncIdState.debugLabel = 'runSyncIdState';
    themeModeState.debugLabel = 'themeModeState';
    noticeHistoryState.debugLabel = 'noticeHistoryState';
    contentListMessageState.debugLabel = 'contentListMessageState';
    focusGlobalInputRandomState.debugLabel = 'focusGlobalInputState';
    isModifiedState.debugLabel = 'isModifiedState';
    globalBackDropState.debugLabel = 'globalBackDropState';
    loginedMenuAnchorState.debugLabel = 'loginedMenuState';
    fileUploaderOpenState.debugLabel = 'fileUploaderOpenState';
    selectedItemsState.debugLabel = 'selectedItemsState';
    toggleItemSelection.debugLabel = 'toggleItemSelection';
    selectionModeState.debugLabel = 'selectionModeState';
    openFileUploaderState.debugLabel = 'openFileUploaderState';
    profileDialogState.debugLabel = 'profileDialogState';
    profileUpdateState.debugLabel = 'profileUpdateState';
    editorUploaderContextState.debugLabel = 'editorUploaderContextState';
    openFileUploaderWithEditorState.debugLabel = 'openFileUploaderWithEditorState';
    refreshListState.debugLabel = 'refreshListState';
    folderCreationDialogState.debugLabel = 'folderCreationDialogState';
    openFolderCreationDialogState.debugLabel = 'openFolderCreationDialogState';
    closeFolderCreationDialogState.debugLabel = 'closeFolderCreationDialogState';
    syncCompletedRefreshState.debugLabel = 'syncCompletedRefreshState';
    triggerSyncCompletedRefresh.debugLabel = 'triggerSyncCompletedRefresh';
}
