/**
 * 텍스트 길이 제한 관련 상수 및 유틸리티 함수
 */

/**
 * 제목과 본문의 최대 길이
 * 오티유의 장점(빠른메모에 긴 데이터 저장 가능)을 유지하면서도 합리적인 제한
 */
export const MAX_TEXT_LENGTH = 50000;

/**
 * 텍스트 길이가 유효한지 검증
 * @param text - 검증할 텍스트
 * @returns 길이가 제한 이하이면 true, 초과하면 false
 */
export function isTextLengthValid(text: string | null | undefined): boolean {
    if (!text) {
        return true;
    }
    return text.length <= MAX_TEXT_LENGTH;
}

/**
 * 텍스트를 최대 길이로 잘라냄
 * @param text - 잘라낼 텍스트
 * @returns 최대 길이 이하로 잘린 텍스트
 */
export function truncateText(text: string | null | undefined): string {
    if (!text) {
        return '';
    }
    if (text.length <= MAX_TEXT_LENGTH) {
        return text;
    }
    return text.substring(0, MAX_TEXT_LENGTH);
}
