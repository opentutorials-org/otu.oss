/**
 * AI 기능 설정 유틸리티
 *
 * AI 관련 환경변수(API 키 또는 Gateway)가 설정되어 있으면 자동으로 활성화됩니다.
 * API 키가 없는 환경에서도 앱이 정상 동작하도록 graceful fallback을 제공합니다.
 */

/**
 * OpenAI API 키가 설정되어 있는지 확인
 */
export function isOpenAIConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * AI 기능이 활성화되어 있는지 확인
 * 프로덕션에서는 Vercel AI Gateway를 사용하므로 항상 활성화
 * 그 외 환경(development, test)에서는 OPENAI_API_KEY가 설정되어 있어야 활성화
 */
export function isAIEnabled(): boolean {
    if (process.env.NODE_ENV === 'production') return true;
    return isOpenAIConfigured();
}

/**
 * 임베딩 API가 설정되어 있는지 확인
 * 프로덕션에서는 Vercel AI Gateway, 그 외에서는 OpenAI API 키 필요
 */
export function isEmbeddingConfigured(): boolean {
    if (process.env.NODE_ENV === 'production') return true;
    return isOpenAIConfigured();
}

/**
 * AI 기능을 사용할 수 있는지 확인
 * 현재 isAIEnabled()와 동일하지만, 향후 추가 조건(할당량 등) 확장을 위해 유지
 */
export function canUseAI(): boolean {
    return isAIEnabled();
}

/**
 * RAG/임베딩 기능을 사용할 수 있는지 확인
 */
export function canUseEmbeddings(): boolean {
    return isAIEnabled() && isEmbeddingConfigured();
}

/**
 * AI 비활성화 이유를 반환
 * AI가 활성화되어 있으면 null을 반환
 */
export function getAIDisabledReason(): string | null {
    if (isAIEnabled()) return null;

    if (!isOpenAIConfigured()) {
        return 'OPENAI_API_KEY_NOT_SET';
    }

    return 'UNKNOWN';
}

/**
 * 임베딩 비활성화 이유를 반환
 * 임베딩이 활성화되어 있으면 null을 반환
 */
export function getEmbeddingsDisabledReason(): string | null {
    if (canUseEmbeddings()) return null;

    if (!isOpenAIConfigured()) {
        return 'OPENAI_API_KEY_NOT_SET';
    }

    return 'UNKNOWN';
}
