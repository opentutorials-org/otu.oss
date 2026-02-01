import { convert, htmlToText } from 'html-to-text';

/**
 * HTML 문자열이 실질적으로 비어있는지 확인
 */
export function isEffectivelyEmptyBody(html: string): boolean {
    if (!html || html.trim() === '') return true;

    // HTML을 일반 텍스트로 변환 (HTML 태그 및 &nbsp; 등의 엔티티 제거)
    const plainText = convert(html, {
        wordwrap: false,
        selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' },
        ],
    });

    return plainText.trim() === '';
}

/**
 * 타이틀이 실질적으로 비어있는지 확인
 */
export function isEffectivelyEmptyTitle(text: string): boolean {
    if (!text || text.trim() === '') return true;

    // HTML 태그 제거
    const withoutTags = text.replace(/<[^>]*>/g, '');
    // 특수 공백 문자(&nbsp;) 제거
    const withoutNbsp = withoutTags.replace(/&nbsp;/g, '');

    return withoutNbsp.trim() === '';
}

/**
 * 첫 번째 텍스트 조각을 추출하여 제목으로 사용
 */
export function extractTitleFromBody(body: string, maxLength: number = 15): string {
    const plainTextBody = body.replace(/<[^>]*>/g, '');
    return plainTextBody.substring(0, maxLength);
}

/**
 * 저장 버튼 상태 관련 유틸리티 함수
 */
export function shouldDisableSaveButton(isModified: boolean): boolean {
    return !isModified;
}

export function shouldShowSaveText(mode: 'create' | 'update' | null, isModified: boolean): boolean {
    return mode === 'create' && !isModified;
}

export function isReadyEditor(isOpen: boolean, mode: 'create' | 'update' | null): boolean {
    return isOpen && (mode === 'create' || mode === 'update');
}

/**
 * 목록에서 표시할 제목을 생성하는 함수
 * 제목이 있으면 제목을 반환하고, 없으면 본문에서 적절한 길이의 텍스트를 추출
 */
export function getDisplayTitle(
    title: string,
    body: string,
    maxLength: number = 50,
    noTitleText: string = '제목 없음'
): string {
    let displayText = '';

    // 제목이 있으면 제목 사용
    if (title && title.trim() !== '') {
        displayText = htmlToText(title.trim());
    }
    // 제목이 없으면 본문에서 추출
    else if (body && body.trim() !== '') {
        // HTML 태그 제거
        const plainText = htmlToText(body);

        if (plainText !== '') {
            // 첫 번째 줄 또는 첫 번째 문장 추출
            const firstLine = plainText.split('\n')[0].trim();
            const firstSentence = plainText.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || '';

            // 둘 중 더 짧은 것을 선택
            displayText = firstLine.length <= firstSentence.length ? firstLine : firstSentence;

            // 빈 문자열이면 전체 텍스트에서 추출
            if (!displayText) {
                displayText = plainText;
            }
        }
    }

    // 최종적으로 텍스트가 없으면 기본값 반환
    if (!displayText) {
        return noTitleText;
    }

    // 최대 길이로 자르기 (제목이든 본문 추출이든 모두 적용)
    if (displayText.length > maxLength) {
        displayText = displayText.substring(0, maxLength - 3) + '...';
    }

    return displayText;
}
