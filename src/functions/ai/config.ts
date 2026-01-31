/**
 * AI 기능 설정 유틸리티
 *
 * ENABLE_AI 환경변수로 AI 기능을 선택적으로 활성화/비활성화할 수 있습니다.
 * API 키가 없는 환경에서도 앱이 정상 동작하도록 graceful fallback을 제공합니다.
 */

/**
 * AI 기능이 활성화되어 있는지 확인
 * ENABLE_AI 환경변수가 'true'인 경우에만 true 반환
 * 환경변수가 설정되지 않으면 기본값은 false (오픈소스 친화적)
 */
export function isAIEnabled(): boolean {
    return process.env.ENABLE_AI === 'true';
}

/**
 * OpenAI API 키가 설정되어 있는지 확인
 */
export function isOpenAIConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * 임베딩 API가 설정되어 있는지 확인
 * 개발 환경에서는 OpenAI API 키, 프로덕션에서는 Vercel AI Gateway 사용
 */
export function isEmbeddingConfigured(): boolean {
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
        return !!process.env.OPENAI_API_KEY;
    }
    // 프로덕션에서는 Gateway를 사용하므로 항상 true
    return true;
}

/**
 * AI 기능을 사용할 수 있는지 확인 (활성화 + API 키 설정)
 * 개발 환경에서는 OpenAI 직접 호출, 프로덕션에서는 Gateway 사용
 */
export function canUseAI(): boolean {
    if (!isAIEnabled()) {
        return false;
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
        return isOpenAIConfigured();
    }

    // 프로덕션에서는 Gateway를 사용하므로 TEXT_MODEL_NAME만 확인
    return !!process.env.TEXT_MODEL_NAME;
}

/**
 * RAG/임베딩 기능을 사용할 수 있는지 확인
 */
export function canUseEmbeddings(): boolean {
    return isAIEnabled() && isEmbeddingConfigured();
}

/**
 * AI 비활성화 이유를 반환
 */
export function getAIDisabledReason(): string {
    if (!isAIEnabled()) {
        return 'AI_DISABLED';
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment && !isOpenAIConfigured()) {
        return 'OPENAI_API_KEY_NOT_SET';
    }

    if (!process.env.TEXT_MODEL_NAME) {
        return 'TEXT_MODEL_NAME_NOT_SET';
    }

    return 'UNKNOWN';
}

/**
 * 임베딩 비활성화 이유를 반환
 */
export function getEmbeddingsDisabledReason(): string {
    if (!isAIEnabled()) {
        return 'AI_DISABLED';
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment && !isOpenAIConfigured()) {
        return 'OPENAI_API_KEY_NOT_SET';
    }

    return 'UNKNOWN';
}
