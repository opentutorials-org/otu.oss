import { editorViewLogger } from '@/debug/editor';

/**
 * 본문 내용이 실질적으로 비어있는지 확인
 */
export function isEffectivelyEmptyBody(html: string): boolean {
    // "<p><br></p>"나 "<p></p>" 등 실질적으로 비어있는 HTML
    const emptyPatterns = [
        /^<p><br><\/p>$/,
        /^<p><\/p>$/,
        /^<p>\s*<\/p>$/,
        /^<p>\s*<br>\s*<\/p>$/,
        /^<br>$/,
        /^\s*$/,
    ];

    for (const pattern of emptyPatterns) {
        if (pattern.test(html)) {
            return true;
        }
    }

    // HTML 태그를 제거하고 텍스트만 추출
    const textOnly = html.replace(/<[^>]*>/g, '').trim();
    return textOnly === '';
}

/**
 * 제목이 실질적으로 비어있는지 확인
 */
export function isEffectivelyEmptyTitle(text: string): boolean {
    return text.trim() === '';
}

/**
 * 수정 버튼의 비활성화 여부 결정
 */
export function shouldDisable(isModified: boolean) {
    const result = !isModified;
    editorViewLogger('shouldDisable - isModified:', isModified, 'result:', result);
    return result;
}

/**
 * 저장 버튼의 텍스트를 결정
 */
export function shouldShowSave(mode: 'create' | 'update' | null, isModified: boolean) {
    const result = isModified || mode === 'create';
    editorViewLogger('shouldShowSave - mode:', mode, 'isModified:', isModified, 'result:', result);
    return result;
}

/**
 * 에디터가 준비되었는지 확인
 */
export function isReadyEditor(openInfo: { open: boolean; mode: 'create' | 'update' | null }) {
    const result = openInfo.open && (openInfo.mode === 'create' || openInfo.mode === 'update');
    editorViewLogger('isReadyEditor', result);
    return result;
}
