/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';

// langfuse SDK 로드를 차단하여 CI 워커 OOM 방지 (#143)
jest.mock('langfuse', () => ({
    Langfuse: jest.fn(),
}));

import { startRAGTrace, traceLLMCall } from '../tracing';
import { shutdownLangfuse } from '../config';

describe('Langfuse Tracing', () => {
    const originalEnv = process.env;

    beforeEach(async () => {
        process.env = { ...originalEnv };
        await shutdownLangfuse();
    });

    afterAll(async () => {
        process.env = originalEnv;
        await shutdownLangfuse();
    });

    describe('startRAGTrace (비활성화 시)', () => {
        test('Langfuse 비활성화 시 no-op 핸들 반환', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

            expect(handle.traceId).toBe('noop');
        });

        test('no-op 핸들의 모든 메서드가 에러 없이 동작', async () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

            // 모든 메서드가 에러 없이 실행되어야 함
            expect(() => {
                handle.logRetrieval({
                    query: 'test',
                    resultCount: 0,
                    latencyMs: 100,
                });
            }).not.toThrow();

            expect(() => {
                handle.logCRAGEvaluation({
                    pipelineResult: {
                        results: [],
                        state: {
                            originalQuery: 'test',
                            currentQuery: 'test',
                            searchResults: [],
                            retryCount: 0,
                            maxRetries: 2,
                            stage: 'complete',
                        },
                        useReferences: false,
                        route: 'direct',
                    },
                    latencyMs: 50,
                });
            }).not.toThrow();

            expect(() => {
                handle.logGeneration({
                    model: 'gpt-4',
                    prompt: 'test',
                    completion: 'test',
                    latencyMs: 200,
                });
            }).not.toThrow();

            await expect(handle.complete()).resolves.toBeUndefined();
        });
    });

    describe('traceLLMCall (비활성화 시)', () => {
        test('Langfuse 비활성화 시 에러 없이 반환', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            expect(() => {
                traceLLMCall({
                    userId: 'test-user',
                    model: 'gpt-4',
                    prompt: 'test prompt',
                    completion: 'test completion',
                    latencyMs: 100,
                });
            }).not.toThrow();
        });
    });
});
