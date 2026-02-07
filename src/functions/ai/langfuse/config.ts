/**
 * Langfuse 설정 및 초기화
 *
 * LLM/RAG 시스템의 품질 모니터링을 위한 Langfuse 통합입니다.
 * 환경 변수가 설정되지 않으면 graceful하게 비활성화됩니다.
 *
 * @see https://langfuse.com/docs
 */

import { Langfuse } from 'langfuse';
import { aiLogger } from '@/debug/ai';

/**
 * Langfuse 설정 (discriminated union)
 *
 * enabled=true일 때만 publicKey/secretKey가 존재하도록 타입 보장합니다.
 * 이를 통해 non-null assertion(!) 없이 안전하게 키에 접근할 수 있습니다.
 */
export type LangfuseConfig =
    | { enabled: false }
    | {
          enabled: true;
          publicKey: string;
          secretKey: string;
          baseUrl?: string;
          debug?: boolean;
      };

/**
 * 환경 변수에서 Langfuse 설정을 로드합니다.
 */
export function loadLangfuseConfig(): LangfuseConfig {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = process.env.LANGFUSE_HOST;

    // 환경 변수가 없거나 명시적으로 비활성화되면 disabled 반환
    const enabled =
        process.env.LANGFUSE_ENABLED !== 'false' && Boolean(publicKey) && Boolean(secretKey);

    if (!enabled || !publicKey || !secretKey) {
        return { enabled: false };
    }

    return {
        enabled: true,
        publicKey,
        secretKey,
        baseUrl,
        debug: process.env.NODE_ENV === 'development',
    };
}

// 싱글톤 Langfuse 인스턴스
let langfuseInstance: Langfuse | null = null;
let langfuseConfig: LangfuseConfig | null = null;

/**
 * Langfuse 인스턴스를 가져옵니다.
 * 설정이 없으면 null을 반환합니다.
 */
export function getLangfuse(): Langfuse | null {
    if (langfuseConfig === null) {
        langfuseConfig = loadLangfuseConfig();
    }

    if (!langfuseConfig.enabled) {
        return null;
    }

    if (langfuseInstance === null) {
        try {
            langfuseInstance = new Langfuse({
                publicKey: langfuseConfig.publicKey,
                secretKey: langfuseConfig.secretKey,
                baseUrl: langfuseConfig.baseUrl,
            });
        } catch (error) {
            aiLogger('Langfuse initialization failed: %s', (error as Error)?.message);
            return null;
        }
    }

    return langfuseInstance;
}

/**
 * Langfuse 활성화 여부를 확인합니다.
 */
export function isLangfuseEnabled(): boolean {
    if (langfuseConfig === null) {
        langfuseConfig = loadLangfuseConfig();
    }
    return langfuseConfig.enabled;
}

/**
 * Langfuse 비활성화 이유를 반환합니다.
 */
export function getLangfuseDisabledReason(): string | null {
    if (langfuseConfig === null) {
        langfuseConfig = loadLangfuseConfig();
    }

    if (langfuseConfig.enabled) {
        return null;
    }

    // enabled: false일 때 환경 변수에서 직접 원인 판별
    if (process.env.LANGFUSE_ENABLED === 'false') {
        return 'LANGFUSE_ENABLED is set to false';
    }

    if (!process.env.LANGFUSE_PUBLIC_KEY) {
        return 'LANGFUSE_PUBLIC_KEY is not set';
    }

    if (!process.env.LANGFUSE_SECRET_KEY) {
        return 'LANGFUSE_SECRET_KEY is not set';
    }

    return 'Unknown reason';
}

/**
 * Langfuse 인스턴스를 종료합니다.
 * 서버 종료 시 호출해야 합니다.
 */
export async function shutdownLangfuse(): Promise<void> {
    if (langfuseInstance) {
        await langfuseInstance.shutdownAsync();
        langfuseInstance = null;
    }
    langfuseConfig = null;
}
