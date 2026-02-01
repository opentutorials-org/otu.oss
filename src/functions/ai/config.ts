/**
 * AI 기능 설정 유틸리티
 *
 * ENABLE_AI 환경변수로 AI 기능을 선택적으로 활성화/비활성화할 수 있습니다.
 * API 키가 없는 환경에서도 앱이 정상 동작하도록 graceful fallback을 제공합니다.
 *
 * AI Provider:
 * - 'gateway': Vercel AI Gateway (Vercel 배포 시 기본값)
 * - 'openai': OpenAI 직접 호출 (셀프호스팅 시 사용)
 */

/**
 * AI Provider 타입
 * - 'gateway': Vercel AI Gateway 사용 (Vercel 배포 환경)
 * - 'openai': OpenAI API 직접 호출 (셀프호스팅 환경)
 */
export type AIProvider = 'gateway' | 'openai';

/**
 * 현재 AI Provider를 반환
 * AI_PROVIDER 환경변수로 설정, 기본값은 'gateway' (Vercel 배포 호환)
 */
export function getAIProvider(): AIProvider {
    const provider = process.env.AI_PROVIDER;
    if (provider === 'openai') {
        return 'openai';
    }
    return 'gateway';
}

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
 * Provider에 따라 검증 방법이 다름:
 * - openai: OPENAI_API_KEY 필요
 * - gateway: Vercel AI Gateway를 사용하므로 항상 true
 */
export function isEmbeddingConfigured(): boolean {
    const provider = getAIProvider();
    if (provider === 'openai') {
        return !!process.env.OPENAI_API_KEY;
    }
    // Gateway 모드에서는 Vercel이 제공하므로 항상 true
    return true;
}

/**
 * AI 기능을 사용할 수 있는지 확인 (활성화 + Provider별 키 설정)
 */
export function canUseAI(): boolean {
    if (!isAIEnabled()) {
        return false;
    }

    const provider = getAIProvider();
    if (provider === 'openai') {
        return isOpenAIConfigured();
    }

    // Gateway 모드에서는 TEXT_MODEL_NAME만 확인
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

    const provider = getAIProvider();
    if (provider === 'openai' && !isOpenAIConfigured()) {
        return 'OPENAI_API_KEY_NOT_SET';
    }

    if (provider === 'gateway' && !process.env.TEXT_MODEL_NAME) {
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

    const provider = getAIProvider();
    if (provider === 'openai' && !isOpenAIConfigured()) {
        return 'OPENAI_API_KEY_NOT_SET';
    }

    return 'UNKNOWN';
}
