/**
 * AI 기능 상태를 확인하는 클라이언트 훅
 *
 * 서버의 /api/check/ai 엔드포인트를 호출하여 AI 설정 상태를 확인합니다.
 */

import { useState, useEffect } from 'react';

export interface AIStatus {
    enabled: boolean;
    canUseChat: boolean;
    canUseEmbeddings: boolean;
}

const defaultStatus: AIStatus = {
    enabled: false,
    canUseChat: false,
    canUseEmbeddings: false,
};

// 캐시된 상태와 프로미스
let cachedStatus: AIStatus | null = null;
let fetchPromise: Promise<AIStatus> | null = null;

async function fetchAIStatus(): Promise<AIStatus> {
    // 이미 캐시된 상태가 있으면 반환
    if (cachedStatus) {
        return cachedStatus;
    }

    // 이미 진행 중인 요청이 있으면 그 프로미스를 반환
    if (fetchPromise) {
        return fetchPromise;
    }

    // 새로운 요청 시작
    fetchPromise = fetch('/api/check/ai')
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to fetch AI status');
            }
            return response.json();
        })
        .then((data) => {
            cachedStatus = data;
            return data;
        })
        .catch(() => {
            // 에러 발생 시 기본값 반환
            return defaultStatus;
        })
        .finally(() => {
            fetchPromise = null;
        });

    return fetchPromise;
}

/**
 * AI 상태를 확인하는 훅
 * @returns { status, isLoading } - AI 상태와 로딩 상태
 */
export function useAIStatus() {
    const [status, setStatus] = useState<AIStatus>(cachedStatus || defaultStatus);
    const [isLoading, setIsLoading] = useState(!cachedStatus);

    useEffect(() => {
        // 이미 캐시된 상태가 있으면 로딩 완료
        if (cachedStatus) {
            setStatus(cachedStatus);
            setIsLoading(false);
            return;
        }

        fetchAIStatus().then((data) => {
            setStatus(data);
            setIsLoading(false);
        });
    }, []);

    return { status, isLoading };
}

/**
 * AI 상태 캐시를 초기화하는 함수
 * 설정이 변경된 경우 호출하여 새로운 상태를 가져올 수 있습니다.
 */
export function clearAIStatusCache() {
    cachedStatus = null;
}
