/**
 * @jest-environment node
 *
 * Langfuse enabled-path 테스트
 * config 모듈을 모킹하여 SDK 예외 보호를 검증합니다.
 *
 * SWC/next-jest에서 jest.mock hoisting이 안 되므로
 * require()로 동적 import하여 mock이 먼저 적용되도록 합니다.
 */
import { describe, test, expect, beforeEach, afterAll, jest } from '@jest/globals';

const mockGetLangfuse = jest.fn();
const mockIsEnabled = jest.fn();

jest.mock('../config', () => {
    const actual = jest.requireActual('../config') as any;
    return {
        __esModule: true,
        ...actual,
        getLangfuse: mockGetLangfuse,
        isLangfuseEnabled: mockIsEnabled,
    };
});

// jest.mock 이후 require — mock이 적용된 상태로 tracing 모듈이 로드됨
const { startRAGTrace } = require('../tracing') as typeof import('../tracing');

function createMockLangfuse() {
    return {
        trace: jest.fn().mockReturnValue({
            id: 'mock-trace-id',
            span: jest.fn(),
            generation: jest.fn(),
            score: jest.fn(),
        }),
        generation: jest.fn(),
        flushAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        shutdownAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
        score: jest.fn(),
        span: jest.fn(),
    };
}

describe('Langfuse Tracing (enabled-path)', () => {
    let mockLangfuse: ReturnType<typeof createMockLangfuse>;

    beforeEach(() => {
        mockLangfuse = createMockLangfuse();
        mockIsEnabled.mockReturnValue(true);
        mockGetLangfuse.mockReturnValue(mockLangfuse);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('startRAGTrace (활성화 시 — SDK 예외 보호)', () => {
        test('langfuse.trace() 예외 시 noopTraceHandle 반환', () => {
            mockLangfuse.trace.mockImplementationOnce(() => {
                throw new Error('trace creation failed');
            });

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

            expect(handle.traceId).toBe('noop');
        });

        test('handle.logRetrieval() 중 span() 예외 시 예외가 전파되지 않음', () => {
            const traceResult = {
                id: 'mock-trace-id',
                span: jest.fn().mockImplementationOnce(() => {
                    throw new Error('span failed');
                }),
                generation: jest.fn(),
                score: jest.fn(),
            };
            mockLangfuse.trace.mockReturnValue(traceResult);

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

            expect(() => {
                handle.logRetrieval({
                    query: 'test',
                    resultCount: 5,
                    latencyMs: 100,
                });
            }).not.toThrow();
        });

        test('handle.logCRAGEvaluation() 중 span() 예외 시 예외가 전파되지 않음', () => {
            const traceResult = {
                id: 'mock-trace-id',
                span: jest.fn().mockImplementationOnce(() => {
                    throw new Error('span failed');
                }),
                generation: jest.fn(),
                score: jest.fn(),
            };
            mockLangfuse.trace.mockReturnValue(traceResult);

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

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
        });

        test('handle.logGeneration() 중 generation() 예외 시 예외가 전파되지 않음', () => {
            const traceResult = {
                id: 'mock-trace-id',
                span: jest.fn(),
                generation: jest.fn().mockImplementationOnce(() => {
                    throw new Error('generation failed');
                }),
                score: jest.fn(),
            };
            mockLangfuse.trace.mockReturnValue(traceResult);

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

            expect(() => {
                handle.logGeneration({
                    model: 'gpt-4',
                    prompt: 'test',
                    completion: 'test',
                    latencyMs: 200,
                });
            }).not.toThrow();
        });

        test('handle.complete() 중 score() 예외 후에도 flushAsync 호출됨', async () => {
            const traceResult = {
                id: 'mock-trace-id',
                span: jest.fn(),
                generation: jest.fn(),
                score: jest.fn().mockImplementationOnce(() => {
                    throw new Error('score failed');
                }),
            };
            mockLangfuse.trace.mockReturnValue(traceResult);

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

            await handle.complete({ score: 0.8, comment: 'good' });

            expect(mockLangfuse.flushAsync).toHaveBeenCalled();
        });
    });

    // withLangfuse의 콜백 에러 / flushAsync 검증은 config.test.ts에서 이미 수행
    // traceLLMCall은 withLangfuse를 통해 호출하므로 동일하게 config.test.ts에서 커버
});
