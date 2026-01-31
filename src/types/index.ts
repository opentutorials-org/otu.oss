export type contentType = 'page' | 'book' | 'library';

// id, title, body, is_public, child_count, parent_count, user_id, embedding, created_at, type
export type content = {
    id: string;
    title: string | null;
    body: string | null;
    is_public: boolean | null;
    child_count: number | null;
    parent_count: number | null;
    user_id: string;
    created_at: string;
    type: contentType;
};

export type contentItem = {
    id: number;
    type: contentType;
    href: string;
    title: string | null;
    is_public: boolean | null;
    separator: string | null;
};
/**
 * ErrorResponseParams 인터페이스 - 에러 응답 매개변수
 * @typedef {Object} ErrorResponseParams
 * @property {string} message - 에러 메시지
 * @property {Record<string, unknown>} [meta] - 추가 메타 데이터
 * @property {number} [errorCode=500] - HTTP 응답 상태 코드 (기본값 500)
 */
export interface ResponseParams {
    message: string;
    meta?: object;
    errorCode?: string;
    status?: number;
    data?: object;
}

export type editorStateType = {
    open: boolean;
    id: string;
    type: contentType;
    mode: 'create' | 'update' | null;
    onClose?: () => void;
    onSaved?: () => void;
};
