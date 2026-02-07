/**
 * @jest-environment node
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { testLogger } from '@/debug/test';
import { runCRAGPipeline, DEFAULT_CRAG_CONFIG } from '@/functions/ai/crag';
import type { similarityResponse } from '@/lib/jotai';

describe('Chat Input CRAG 통합 테스트', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    const createMockSearchFn = (results: similarityResponse[]) => {
        return jest.fn<(q: string) => Promise<similarityResponse[]>>().mockResolvedValue(results);
    };

    const createHighRelevanceResults = (): similarityResponse[] => [
        {
            id: 'id-1',
            content: 'React 사용법을 알아봅시다. React는 Facebook이 개발한 UI 라이브러리입니다.',
            metadata: { type: 'page', title: 'React 가이드' },
            similarity: 0.85,
            page_id: 'page-1',
        },
    ];

    describe('CRAG 비활성화 시 (기본 동작)', () => {
        test('NEXT_PUBLIC_CRAG_ENABLED 미설정 시 직접 검색만 수행', async () => {
            delete process.env.NEXT_PUBLIC_CRAG_ENABLED;

            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: process.env.NEXT_PUBLIC_CRAG_ENABLED === 'true',
            };

            const result = await runCRAGPipeline('React 사용법 알려줘', searchFn, config);

            expect(result.route).toBe('direct');
            expect(result.results).toHaveLength(1);
            expect(searchFn).toHaveBeenCalledTimes(1);
            expect(searchFn).toHaveBeenCalledWith('React 사용법 알려줘');

            testLogger('CRAG 비활성화 → 직접 검색 수행 확인');
        });

        test('NEXT_PUBLIC_CRAG_ENABLED=false 시 직접 검색만 수행', async () => {
            process.env.NEXT_PUBLIC_CRAG_ENABLED = 'false';

            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: process.env.NEXT_PUBLIC_CRAG_ENABLED === 'true',
            };

            const result = await runCRAGPipeline('React 사용법', searchFn, config);

            expect(result.route).toBe('direct');
            expect(searchFn).toHaveBeenCalledTimes(1);

            testLogger('CRAG 명시적 비활성화 → 직접 검색 수행 확인');
        });

        test('검색 결과 없어도 에러 없이 진행', async () => {
            delete process.env.NEXT_PUBLIC_CRAG_ENABLED;

            const searchFn = createMockSearchFn([]);
            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: false,
            };

            const result = await runCRAGPipeline('존재하지 않는 주제', searchFn, config);

            expect(result.route).toBe('direct');
            expect(result.results).toHaveLength(0);
            expect(result.useReferences).toBe(false);

            testLogger('검색 결과 없음 → 빈 배열 반환 확인');
        });
    });

    describe('CRAG 활성화 시', () => {
        test('NEXT_PUBLIC_CRAG_ENABLED=true 시 평가 수행', async () => {
            process.env.NEXT_PUBLIC_CRAG_ENABLED = 'true';

            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: process.env.NEXT_PUBLIC_CRAG_ENABLED === 'true',
            };

            const result = await runCRAGPipeline('React 사용법 알려줘', searchFn, config);

            expect(result.route).toBe('crag');
            expect(result.useReferences).toBe(true);
            expect(result.state.evaluation).toBeDefined();
            expect(result.state.evaluation?.grade).toBe('correct');

            testLogger('CRAG 활성화 → 평가 수행 확인');
        });

        test('낮은 관련성 시 참조 없이 진행', async () => {
            process.env.NEXT_PUBLIC_CRAG_ENABLED = 'true';

            const lowRelevanceResults: similarityResponse[] = [
                {
                    id: 'id-1',
                    content: '오늘 날씨가 좋습니다.',
                    metadata: { type: 'page', title: '날씨' },
                    similarity: 0.2,
                    page_id: 'page-1',
                },
            ];

            const searchFn = createMockSearchFn(lowRelevanceResults);
            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: true,
            };

            const result = await runCRAGPipeline('React 사용법 알려줘', searchFn, config);

            expect(result.route).toBe('crag');
            expect(result.useReferences).toBe(false);
            expect(result.results).toHaveLength(0);
            expect(result.state.evaluation?.grade).toBe('incorrect');

            testLogger('낮은 관련성 → 참조 제외 확인');
        });
    });

    describe('단계별 로깅', () => {
        test('onStageChange 콜백 호출 확인', async () => {
            delete process.env.NEXT_PUBLIC_CRAG_ENABLED;

            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const stages: string[] = [];
            const onStageChange = (stage: any) => {
                stages.push(stage);
            };

            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: false,
            };

            await runCRAGPipeline('React', searchFn, config, onStageChange);

            // direct 경로는 searching, complete 호출 (CRAG 비활성화 시)
            expect(stages).toContain('searching');
            expect(stages).toContain('complete');
            expect(stages.length).toBeGreaterThan(0);

            testLogger(`단계별 로깅: ${stages.join(' → ')}`);
        });

        test('CRAG 활성화 시 evaluating 단계 포함', async () => {
            process.env.NEXT_PUBLIC_CRAG_ENABLED = 'true';

            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const stages: string[] = [];
            const onStageChange = (stage: any) => {
                stages.push(stage);
            };

            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: true,
            };

            await runCRAGPipeline('React 사용법', searchFn, config, onStageChange);

            expect(stages).toContain('evaluating');
            testLogger(`CRAG 단계: ${stages.join(' → ')}`);
        });
    });

    describe('에러 처리', () => {
        test('검색 실패 시 에러 전파', async () => {
            delete process.env.NEXT_PUBLIC_CRAG_ENABLED;

            const searchFn = jest
                .fn<(q: string) => Promise<similarityResponse[]>>()
                .mockRejectedValue(new Error('Network error'));

            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: false,
            };

            // 파이프라인은 에러를 전파하므로, Chat Input에서 catch해서 빈 배열 반환
            await expect(runCRAGPipeline('React', searchFn, config)).rejects.toThrow(
                'Network error'
            );

            testLogger('검색 에러 → 에러 전파 확인 (Chat Input에서 catch)');
        });
    });

    describe('파이프라인 상태 정보', () => {
        test('state에 쿼리 정보 포함', async () => {
            delete process.env.NEXT_PUBLIC_CRAG_ENABLED;

            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const config = {
                ...DEFAULT_CRAG_CONFIG,
                enabled: false,
            };

            const result = await runCRAGPipeline('React 사용법', searchFn, config);

            expect(result.state.originalQuery).toBe('React 사용법');
            expect(result.state.currentQuery).toBe('React 사용법');
            expect(result.state.searchResults).toHaveLength(1);
            expect(result.state.stage).toBe('complete');

            testLogger('파이프라인 상태 정보 확인 완료');
        });
    });
});
