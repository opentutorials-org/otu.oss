/**
 * AI 기능 설정 유틸리티
 *
 * ENABLE_AI 환경변수로 AI 기능을 선택적으로 활성화/비활성화할 수 있습니다.
 * AI_PROVIDER 환경변수로 AI 제공자를 선택합니다:
 *   - 'gateway': Vercel AI Gateway (기본값, Vercel 배포 시)
 *   - 'openai': OpenAI 직접 호출 (셀프호스팅 시)
 *
 * API 키가 없는 환경에서도 앱이 정상 동작하도록 graceful fallback을 제공합니다.
 */

/**
 * AI Provider 타입
 * - gateway: Vercel AI Gateway (프로덕션 기본)
 * - openai: OpenAI 직접 호출 (셀프호스팅)
 */
export type AIProvider = 'gateway' | 'openai';

/**
 * 현재 AI Provider를 반환합니다.
 * AI_PROVIDER 환경변수가 'openai'이면 openai, 그 외에는 gateway를 반환합니다.
 */
export function getAIProvider(): AIProvider {
    const provider = process.env.AI_PROVIDER;
    if (provider === 'openai') return 'openai';
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
 * AI_PROVIDER에 따라 분기:
 *   - openai: OPENAI_API_KEY 필요
 *   - gateway: Vercel AI Gateway 사용 (항상 true)
 * @deprecated COHERE_API_KEY는 더 이상 사용되지 않습니다. Vercel AI Gateway를 통해 임베딩을 사용합니다.
 */
export function isCohereConfigured(): boolean {
    const provider = getAIProvider();
    if (provider === 'openai') {
        return !!process.env.OPENAI_API_KEY;
    }
    // gateway에서는 Vercel AI Gateway를 사용하므로 항상 true
    return true;
}

/**
 * AI 기능을 사용할 수 있는지 확인 (활성화 + API 키 설정)
 * AI_PROVIDER에 따라 분기:
 *   - openai: OPENAI_API_KEY 필요
 *   - gateway: TEXT_MODEL_NAME만 확인
 */
export function canUseAI(): boolean {
    if (!isAIEnabled()) {
        return false;
    }

    const provider = getAIProvider();
    if (provider === 'openai') {
        return isOpenAIConfigured();
    }

    // gateway에서는 TEXT_MODEL_NAME만 확인
    return !!process.env.TEXT_MODEL_NAME;
}

/**
 * RAG/임베딩 기능을 사용할 수 있는지 확인
 */
export function canUseEmbeddings(): boolean {
    return isAIEnabled() && isCohereConfigured();
}

/**
 * AI 비활성화 이유를 반환
 * canUseAI()가 true이면 null을 반환
 */
export function getAIDisabledReason(): string | null {
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

    return null;
}

/**
 * 임베딩 비활성화 이유를 반환
 * canUseEmbeddings()가 true이면 null을 반환
 */
export function getEmbeddingsDisabledReason(): string | null {
    if (!isAIEnabled()) {
        return 'AI_DISABLED';
    }

    const provider = getAIProvider();
    if (provider === 'openai' && !isOpenAIConfigured()) {
        return 'OPENAI_API_KEY_NOT_SET';
    }

    return null;
}
