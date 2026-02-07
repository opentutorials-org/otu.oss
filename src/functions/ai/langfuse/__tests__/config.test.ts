/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import {
    loadLangfuseConfig,
    isLangfuseEnabled,
    getLangfuse,
    getLangfuseDisabledReason,
    shutdownLangfuse,
} from '../config';

describe('Langfuse Config', () => {
    const originalEnv = process.env;

    beforeEach(async () => {
        process.env = { ...originalEnv };
        // 각 테스트 전에 싱글톤 상태 리셋
        await shutdownLangfuse();
    });

    afterAll(async () => {
        process.env = originalEnv;
        await shutdownLangfuse();
    });

    describe('loadLangfuseConfig', () => {
        test('키가 모두 설정되면 enabled=true', () => {
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';

            const config = loadLangfuseConfig();

            expect(config.enabled).toBe(true);
            if (config.enabled) {
                expect(config.publicKey).toBe('pk-test');
                expect(config.secretKey).toBe('sk-test');
            }
        });

        test('키가 없으면 enabled=false', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const config = loadLangfuseConfig();

            expect(config.enabled).toBe(false);
        });

        test('LANGFUSE_ENABLED=false면 키가 있어도 비활성화', () => {
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';
            process.env.LANGFUSE_ENABLED = 'false';

            const config = loadLangfuseConfig();

            expect(config.enabled).toBe(false);
        });

        test('LANGFUSE_HOST 설정 가능', () => {
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';
            process.env.LANGFUSE_HOST = 'https://custom.langfuse.com';

            const config = loadLangfuseConfig();

            expect(config.enabled).toBe(true);
            if (config.enabled) {
                expect(config.baseUrl).toBe('https://custom.langfuse.com');
            }
        });
    });

    describe('isLangfuseEnabled', () => {
        test('키가 없으면 false', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            expect(isLangfuseEnabled()).toBe(false);
        });

        test('키가 설정되면 true', () => {
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';

            expect(isLangfuseEnabled()).toBe(true);
        });
    });

    describe('getLangfuse', () => {
        test('비활성화 시 null 반환', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            expect(getLangfuse()).toBeNull();
        });

        test('활성화 시 Langfuse 인스턴스 반환', () => {
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';

            const instance = getLangfuse();
            expect(instance).not.toBeNull();
        });

        test('싱글톤 — 동일 인스턴스 반환', () => {
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';

            const instance1 = getLangfuse();
            const instance2 = getLangfuse();
            expect(instance1).toBe(instance2);
        });
    });

    describe('getLangfuseDisabledReason', () => {
        test('LANGFUSE_ENABLED=false인 경우 이유 반환', () => {
            process.env.LANGFUSE_ENABLED = 'false';

            const reason = getLangfuseDisabledReason();

            expect(reason).toContain('false');
        });

        test('PUBLIC_KEY 미설정 시 이유 반환', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;
            delete process.env.LANGFUSE_ENABLED;

            const reason = getLangfuseDisabledReason();

            expect(reason).toContain('PUBLIC_KEY');
        });
    });

    describe('shutdownLangfuse', () => {
        test('shutdown 후 config가 리셋되어 다시 로드됨', async () => {
            process.env.LANGFUSE_PUBLIC_KEY = 'pk-test';
            process.env.LANGFUSE_SECRET_KEY = 'sk-test';

            // 처음에는 enabled
            expect(isLangfuseEnabled()).toBe(true);

            // shutdown 후 환경 변수 변경
            await shutdownLangfuse();
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            // 다시 확인하면 disabled
            expect(isLangfuseEnabled()).toBe(false);
        });
    });
});
