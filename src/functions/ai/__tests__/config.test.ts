/**
 * @jest-environment node
 */

import {
    isOpenAIConfigured,
    isAIEnabled,
    isEmbeddingConfigured,
    canUseAI,
    canUseEmbeddings,
    getAIDisabledReason,
    getEmbeddingsDisabledReason,
} from '../config';

/** NODE_ENV 변경 헬퍼 (TypeScript readonly 제약 우회) */
function setNodeEnv(value: string): void {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe('AI config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('isOpenAIConfigured', () => {
        it('API 키가 설정되어 있으면 true', () => {
            process.env.OPENAI_API_KEY = 'sk-test-key';
            expect(isOpenAIConfigured()).toBe(true);
        });

        it('API 키가 없으면 false', () => {
            delete process.env.OPENAI_API_KEY;
            expect(isOpenAIConfigured()).toBe(false);
        });
    });

    describe('isAIEnabled', () => {
        it('프로덕션 환경에서는 API 키 없이도 true (Gateway 사용)', () => {
            setNodeEnv('production');
            delete process.env.OPENAI_API_KEY;
            expect(isAIEnabled()).toBe(true);
        });

        it('개발 환경에서 API 키가 있으면 true', () => {
            setNodeEnv('development');
            process.env.OPENAI_API_KEY = 'sk-test-key';
            expect(isAIEnabled()).toBe(true);
        });

        it('개발 환경에서 API 키가 없으면 false', () => {
            setNodeEnv('development');
            delete process.env.OPENAI_API_KEY;
            expect(isAIEnabled()).toBe(false);
        });

        it('테스트 환경에서 API 키가 없으면 false (의도치 않은 API 호출 방지)', () => {
            setNodeEnv('test');
            delete process.env.OPENAI_API_KEY;
            expect(isAIEnabled()).toBe(false);
        });

        it('테스트 환경에서 API 키가 있으면 true', () => {
            setNodeEnv('test');
            process.env.OPENAI_API_KEY = 'sk-test-key';
            expect(isAIEnabled()).toBe(true);
        });
    });

    describe('isEmbeddingConfigured', () => {
        it('프로덕션에서는 항상 true', () => {
            setNodeEnv('production');
            delete process.env.OPENAI_API_KEY;
            expect(isEmbeddingConfigured()).toBe(true);
        });

        it('개발 환경에서 API 키 필요', () => {
            setNodeEnv('development');
            delete process.env.OPENAI_API_KEY;
            expect(isEmbeddingConfigured()).toBe(false);
        });
    });

    describe('canUseAI', () => {
        it('isAIEnabled()와 동일한 결과', () => {
            setNodeEnv('development');
            delete process.env.OPENAI_API_KEY;
            expect(canUseAI()).toBe(false);

            process.env.OPENAI_API_KEY = 'sk-test-key';
            expect(canUseAI()).toBe(true);
        });
    });

    describe('canUseEmbeddings', () => {
        it('AI와 임베딩 모두 활성화되어야 true', () => {
            setNodeEnv('production');
            expect(canUseEmbeddings()).toBe(true);
        });

        it('API 키 없는 개발 환경에서 false', () => {
            setNodeEnv('development');
            delete process.env.OPENAI_API_KEY;
            expect(canUseEmbeddings()).toBe(false);
        });
    });

    describe('getAIDisabledReason', () => {
        it('AI 활성화 시 null 반환', () => {
            setNodeEnv('production');
            expect(getAIDisabledReason()).toBeNull();
        });

        it('API 키 미설정 시 OPENAI_API_KEY_NOT_SET', () => {
            setNodeEnv('development');
            delete process.env.OPENAI_API_KEY;
            expect(getAIDisabledReason()).toBe('OPENAI_API_KEY_NOT_SET');
        });
    });

    describe('getEmbeddingsDisabledReason', () => {
        it('임베딩 활성화 시 null 반환', () => {
            setNodeEnv('production');
            expect(getEmbeddingsDisabledReason()).toBeNull();
        });

        it('API 키 미설정 시 OPENAI_API_KEY_NOT_SET', () => {
            setNodeEnv('development');
            delete process.env.OPENAI_API_KEY;
            expect(getEmbeddingsDisabledReason()).toBe('OPENAI_API_KEY_NOT_SET');
        });
    });
});
