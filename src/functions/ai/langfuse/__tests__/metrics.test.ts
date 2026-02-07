/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import { recordScore, recordRAGASMetrics, recordUserFeedback, recordUsage } from '../metrics';
import { shutdownLangfuse } from '../config';

describe('Langfuse Metrics', () => {
    const originalEnv = process.env;

    beforeEach(async () => {
        process.env = { ...originalEnv };
        delete process.env.LANGFUSE_PUBLIC_KEY;
        delete process.env.LANGFUSE_SECRET_KEY;
        await shutdownLangfuse();
    });

    afterAll(async () => {
        process.env = originalEnv;
        await shutdownLangfuse();
    });

    describe('비활성화 시 graceful 반환', () => {
        test('recordScore — 에러 없이 반환', () => {
            expect(() => {
                recordScore({
                    traceId: 'test-trace',
                    name: 'test-metric',
                    value: 0.8,
                });
            }).not.toThrow();
        });

        test('recordRAGASMetrics — 에러 없이 반환', () => {
            expect(() => {
                recordRAGASMetrics('test-trace', {
                    faithfulness: 0.9,
                    answerRelevancy: 0.85,
                    contextPrecision: 0.8,
                    contextRecall: 0.75,
                });
            }).not.toThrow();
        });

        test('recordUserFeedback — 에러 없이 반환', () => {
            expect(() => {
                recordUserFeedback('test-trace', {
                    type: 'positive',
                    comment: 'Good answer!',
                });
            }).not.toThrow();
        });

        test('recordUsage — 에러 없이 반환', () => {
            expect(() => {
                recordUsage('test-trace', 'gpt-4', {
                    promptTokens: 100,
                    completionTokens: 50,
                    totalTokens: 150,
                });
            }).not.toThrow();
        });
    });
});
