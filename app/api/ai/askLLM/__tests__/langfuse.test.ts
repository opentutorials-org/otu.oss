/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { testLogger } from '@/debug/test';
import { traceLLMCall } from '@/functions/ai/langfuse';

describe('askLLM Langfuse 통합 테스트', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('Langfuse 비활성화 시', () => {
        test('traceLLMCall이 에러 없이 동작', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            expect(() => {
                traceLLMCall({
                    userId: 'test-user',
                    model: 'gpt-4',
                    prompt: 'React 사용법 알려줘',
                    completion: 'React는...',
                    usage: {
                        promptTokens: 10,
                        completionTokens: 50,
                        totalTokens: 60,
                    },
                    latencyMs: 1500,
                    metadata: {
                        referenceCount: 2,
                        historyLength: 4,
                    },
                });
            }).not.toThrow();

            testLogger('traceLLMCall 호출 성공 (Langfuse 비활성화)');
        });

        test('usage 없이도 정상 동작', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            expect(() => {
                traceLLMCall({
                    userId: 'test-user',
                    model: 'gpt-4',
                    prompt: 'Hello',
                    completion: 'Hi',
                    latencyMs: 100,
                });
            }).not.toThrow();

            testLogger('traceLLMCall 호출 성공 (usage 없음)');
        });

        test('metadata 없이도 정상 동작', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            expect(() => {
                traceLLMCall({
                    userId: 'test-user',
                    model: 'gpt-4',
                    prompt: 'Hello',
                    completion: 'Hi',
                    latencyMs: 100,
                    usage: {
                        promptTokens: 5,
                        completionTokens: 5,
                        totalTokens: 10,
                    },
                });
            }).not.toThrow();

            testLogger('traceLLMCall 호출 성공 (metadata 없음)');
        });
    });

    describe('입력 검증', () => {
        test('필수 필드 누락 시에도 크래시하지 않음', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            // userId만 있고 나머지는 빈 값
            expect(() => {
                traceLLMCall({
                    userId: 'test-user',
                    model: '',
                    prompt: '',
                    completion: '',
                    latencyMs: 0,
                });
            }).not.toThrow();

            testLogger('빈 값으로 호출해도 에러 없음');
        });
    });

    describe('usage 타입 호환성', () => {
        test('Vercel AI SDK usage 타입과 호환', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            // Vercel AI SDK v2의 usage 타입 (inputTokens, outputTokens)을
            // Langfuse 타입 (promptTokens, completionTokens)으로 변환
            const aiSdkUsage = {
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
            };

            expect(() => {
                traceLLMCall({
                    userId: 'test-user',
                    model: 'gpt-4',
                    prompt: 'test',
                    completion: 'test',
                    usage: {
                        promptTokens: aiSdkUsage.inputTokens ?? 0,
                        completionTokens: aiSdkUsage.outputTokens ?? 0,
                        totalTokens: aiSdkUsage.totalTokens ?? 0,
                    },
                    latencyMs: 100,
                });
            }).not.toThrow();

            testLogger('Vercel AI SDK v2 usage 타입 변환 성공');
        });

        test('undefined 토큰 값 처리', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const aiSdkUsage = {
                inputTokens: undefined,
                outputTokens: undefined,
                totalTokens: undefined,
            };

            expect(() => {
                traceLLMCall({
                    userId: 'test-user',
                    model: 'gpt-4',
                    prompt: 'test',
                    completion: 'test',
                    usage: {
                        promptTokens: aiSdkUsage.inputTokens ?? 0,
                        completionTokens: aiSdkUsage.outputTokens ?? 0,
                        totalTokens: aiSdkUsage.totalTokens ?? 0,
                    },
                    latencyMs: 100,
                });
            }).not.toThrow();

            testLogger('undefined 토큰 값 → 0 fallback 성공');
        });
    });
});
