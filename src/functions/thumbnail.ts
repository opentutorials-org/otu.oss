import { folderLogger } from '@/debug/folder';

/**
 * URL이 Uploadcare CDN(ucarecdn.com 또는 ucarecd.net)인지 확인합니다.
 * @param url - 확인할 URL 문자열
 * @returns Uploadcare URL이면 true, 아니면 false
 */
export function isUploadcareUrl(url: string | null | undefined): boolean {
    if (!url) return false;

    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        return hostname === 'ucarecdn.com' || hostname.endsWith('.ucarecd.net');
    } catch (error) {
        folderLogger('잘못된 URL 형식', { url, error });
        return false;
    }
}

/**
 * Uploadcare URL에 썸네일 파라미터를 적용하여 반환합니다.
 * 기존에 적용된 다른 파라미터(예: crop)는 유지합니다.
 * @param url - 원본 이미지 URL
 * @param width - 썸네일 너비 (기본값: 300)
 * @param height - 썸네일 높이 (기본값: 300)
 * @returns 썸네일 URL. Uploadcare URL이 아니면 원본 URL 반환
 */
export function getThumbnailUrl(url: string, width = 202, height = 202): string {
    if (!isUploadcareUrl(url)) {
        return url;
    }

    try {
        const urlObj = new URL(url);
        const uuid = urlObj.pathname.split('/')[1];
        if (!uuid) return url;

        return `${urlObj.origin}/${uuid}/-/scale_crop/${width}x${height}/center/-/format/auto/-/quality/smart/-/grayscale/`;
    } catch (error) {
        folderLogger('썸네일 URL 생성 실패', { url, error });
        return url;
    }
}
