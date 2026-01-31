/**
 * 에디터 관련 디버그 로거
 *
 * @description BlockNote 에디터 동작(렌더링, 자동저장, OCR, 백업)을 디버깅할 때 사용합니다.
 *
 * @example
 * // 클라이언트에서 활성화 (전체)
 * localStorage.debug = 'editor:*'
 *
 * // 서버에서 활성화 (전체)
 * DEBUG='editor:*' npm run dev
 *
 * 로그 카테고리:
 * - editor:redactor - 텍스트 편집 작업
 * - editor:view - 에디터 뷰 렌더링
 * - editor:index - 에디터 인덱싱
 * - editor:backup - 백업 저장/복원
 * - editor:blocknote - BlockNote 컴포넌트 동작
 * - editor:ocr - 이미지 OCR 처리
 * - editor:autosave - 자동 저장 트리거
 */
//@ts-ignore
import debug from 'debug';
export const editorRedactorLogger = debug('editor:redactor');
export const editorViewLogger = debug('editor:view');
export const editorIndexLogger = debug('editor:index');
export const editorBackupLogger = debug('editor:backup');
export const editorBlockNoteLogger = debug('editor:blocknote');
export const editorOcrLogger = debug('editor:ocr');
export const editorAutoSaveLogger = debug('editor:autosave');
editorRedactorLogger.log = console.log.bind(console);
editorViewLogger.log = console.log.bind(console);
editorIndexLogger.log = console.log.bind(console);
editorBackupLogger.log = console.log.bind(console);
editorBlockNoteLogger.log = console.log.bind(console);
editorOcrLogger.log = console.log.bind(console);
editorAutoSaveLogger.log = console.log.bind(console);
