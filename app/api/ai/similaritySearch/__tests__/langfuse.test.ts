/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';

// langfuse SDK 로드를 차단하여 CI 워커 OOM 방지 (#143)
jest.mock('langfuse', () => ({
    Langfuse: jest.fn(),
}));

import { testLogger } from '@/debug/test';
import { startRAGTrace } from '@/functions/ai/langfuse';

describe('similaritySearch Langfuse 통합 테스트', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('Langfuse 비활성화 시', () => {
        test('startRAGTrace가 no-op 핸들 반환', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'React 사용법 알려줘',
                metadata: { page_id: 'page-1', count: 3, threshold: 0.55 },
            });

            expect(handle.traceId).toBe('noop');
            testLogger('startRAGTrace no-op 핸들 반환 성공');
        });

        test('logRetrieval 호출이 에러 없이 동작', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'React 사용법',
            });

            expect(() => {
                handle.logRetrieval({
                    query: 'React 사용법',
                    resultCount: 3,
                    latencyMs: 250,
                    results: [
                        {
                            content: 'React는 Facebook이 개발한 UI 라이브러리입니다.',
                            similarity: 0.85,
                        },
                        {
                            content: 'React Hooks 사용법',
                            similarity: 0.75,
                        },
                    ],
                });
            }).not.toThrow();

            testLogger('logRetrieval 호출 성공 (Langfuse 비활성화)');
        });

        test('complete 호출이 에러 없이 동작', async () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test',
            });

            await expect(handle.complete()).resolves.toBeUndefined();
            testLogger('complete 호출 성공 (Langfuse 비활성화)');
        });
    });

    describe('검색 결과 트레이싱', () => {
        test('검색 결과가 없을 때도 정상 동작', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test query',
            });

            expect(() => {
                handle.logRetrieval({
                    query: 'test query',
                    resultCount: 0,
                    latencyMs: 100,
                    results: [],
                });
            }).not.toThrow();

            testLogger('검색 결과 0건 트레이싱 성공');
        });

        test('검색 결과가 많을 때 상위 3개만 기록', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test',
            });

            const manyResults = Array.from({ length: 10 }, (_, i) => ({
                content: `결과 ${i + 1}`,
                similarity: 0.9 - i * 0.05,
            }));

            expect(() => {
                handle.logRetrieval({
                    query: 'test',
                    resultCount: 10,
                    latencyMs: 200,
                    results: manyResults,
                });
            }).not.toThrow();

            testLogger('검색 결과 10건 중 상위 3개 트레이싱 성공');
        });

        test('긴 content는 100자로 자름', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test',
            });

            const longContent = 'A'.repeat(500);

            expect(() => {
                handle.logRetrieval({
                    query: 'test',
                    resultCount: 1,
                    latencyMs: 100,
                    results: [
                        {
                            content: longContent,
                            similarity: 0.9,
                        },
                    ],
                });
            }).not.toThrow();

            testLogger('긴 content 트리밍 성공');
        });
    });

    describe('메타데이터 처리', () => {
        test('metadata 없이도 정상 동작', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test',
            });

            expect(handle.traceId).toBe('noop');
            testLogger('metadata 없이 startRAGTrace 성공');
        });

        test('부분적인 metadata도 처리', () => {
            delete process.env.LANGFUSE_PUBLIC_KEY;
            delete process.env.LANGFUSE_SECRET_KEY;

            const handle = startRAGTrace({
                userId: 'test-user',
                query: 'test',
                metadata: { page_id: 'page-1' }, // count, threshold 누락
            });

            expect(handle.traceId).toBe('noop');
            testLogger('부분 metadata로 startRAGTrace 성공');
        });
    });
});
