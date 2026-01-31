import { ulid } from 'ulid';
import { captionLogger } from '@/debug/caption';
import { fetchUserId } from '@/supabase/utils/client';
import { addBreadcrumb } from '@sentry/nextjs';
import {
    deleteFiles as uploadcareDeleteFiles,
    UploadcareAuthSchema,
} from '@uploadcare/rest-client';

// 이미지 정책 상수
export const IMAGE_SHRINK_POLICY_WIDTH = 1200;
export const IMAGE_SHRINK_POLICY_HEIGHT = 1200;

// 화면 크기 상수
export const SCREEN_SIZE = 564;

/**
 * CDN URL에서 미리보기 관련 부분을 제거합니다.
 */
export function removePreviewFromCdnUrl(cdnUrl: string): string {
    const regex = /-\/preview\/?(\d+x\d+)?\/?$/;
    const match = cdnUrl.match(regex);
    if (match) {
        return cdnUrl.replace(match[0], '').replace(/\/?$/, '/');
    }
    return cdnUrl;
}

/**
 * 파일 다운로드 링크 HTML을 생성합니다.
 */
export function generateDownloadLink(fileUrl: string, fileName: string): string {
    return `<div class="download"><a href="${fileUrl}" download="${fileName}" target="_blank">${fileName}</a></div>`;
}

/**
 * 파일을 Uploadcare에 업로드하고 HTML을 생성합니다.
 */
export async function processFile(
    file: File,
    pageId: string | null,
    signal?: AbortSignal
): Promise<string> {
    // FormData 생성 및 파일 추가
    const formData = new FormData();
    formData.append('UPLOADCARE_PUB_KEY', process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY || '');
    formData.append('UPLOADCARE_STORE', 'auto');
    formData.append('file', file);

    // 메타데이터 추가
    if (pageId) {
        formData.append('metadata[pageId]', pageId);
    }

    const userId = await fetchUserId();
    if (userId) {
        formData.append('metadata[userId]', userId);
    }

    // Uploadcare API로 파일 업로드
    const response = await fetch('https://upload.uploadcare.com/base/', {
        method: 'POST',
        body: formData,
        signal: signal,
    });

    if (!response.ok) {
        throw new Error(`업로드 실패: ${response.status}`);
    }

    const result = await response.json();
    const fileId = result.file;
    const cdnUrl = `https://ucarecdn.com/${fileId}/`;

    // 파일 타입에 따른 처리
    const isImage = file.type.startsWith('image/');

    if (isImage) {
        // 이미지 파일 처리
        const imageUrl = `${removePreviewFromCdnUrl(cdnUrl)}-/preview/${IMAGE_SHRINK_POLICY_WIDTH}x${IMAGE_SHRINK_POLICY_HEIGHT}/`;

        // BlockNote와 호환되는 형식으로 이미지 URL만 반환
        return `<img src="${imageUrl}" />`;
    } else {
        // 일반 파일 처리
        const fileName = file.name || 'Unknown File';
        return generateDownloadLink(cdnUrl, fileName);
    }
}

/**
 * 이미지 캡션을 가져옵니다.
 */
export async function fetchCaption(id: string, imageUrl: string, signal?: AbortSignal) {
    try {
        const response = await fetch('/api/ai/captioning', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, image_url: imageUrl }),
            signal: signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        // AbortError는 정상적인 취소로 간주
        if (error instanceof Error && error.name === 'AbortError') {
            captionLogger('Caption fetching aborted');
        }
        console.error('Error fetching caption', error);
        throw error;
    }
}

/**
 * 사용자 아이디를 가져옵니다.
 */
export async function getUserId(): Promise<string | null> {
    return await fetchUserId();
}

/**
 * 새 페이지 ID를 생성합니다.
 */
export function generatePageId(): string {
    return ulid();
}

/**
 * Uploadcare에서 여러 파일을 삭제합니다.
 */
export async function deleteFiles(uuids: string[]): Promise<void> {
    const publicKey = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;
    const secretKey = process.env.UPLOADCARE_PRIVATE_KEY;

    if (!publicKey || !secretKey) {
        console.error('UPLOADCARE_PUBLIC_KEY, UPLOADCARE_PRIVATE_KEY 환경변수가 필요합니다.');
        return;
    }

    const authSchema = new UploadcareAuthSchema({
        publicKey,
        secretKey,
    });

    const chunkSize = 100;
    for (let i = 0; i < uuids.length; i += chunkSize) {
        const chunk = uuids.slice(i, i + chunkSize);
        try {
            await uploadcareDeleteFiles({ uuids: chunk }, { authSchema });
        } catch (error) {
            console.error('Uploadcare 파일 삭제 실패:', error);
        }
    }
}
