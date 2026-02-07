/**
 * @jest-environment node
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { runCRAGPipeline, loadCRAGConfig } from '../pipeline';
import { DEFAULT_CRAG_CONFIG, CRAGStage } from '../types';
import { similarityResponse } from '@/lib/jotai';

// Mock chatLogger
jest.mock('@/debug/chat', () => ({
    chatLogger: jest.fn(),
}));

describe('CRAG Pipeline', () => {
    // CRAG 활성화된 config (DEFAULT_CRAG_CONFIG는 opt-in이므로 enabled: false)
    const ENABLED_CRAG_CONFIG = { ...DEFAULT_CRAG_CONFIG, enabled: true };

    const createMockSearchFn = (results: similarityResponse[]) => {
        return jest.fn<(q: string) => Promise<similarityResponse[]>>().mockResolvedValue(results);
    };

    const createHighRelevanceResults = (): similarityResponse[] => [
        {
            id: 'id-1',
            content: 'React 사용법을 알아봅시다. React는 Facebook이 개발한 UI 라이브러리입니다.',
            metadata: { type: 'page', title: 'React 사용법 가이드' },
            similarity: 0.85,
            page_id: 'page-1',
        },
        {
            id: 'id-2',
            content: 'React Hooks 사용법과 useState를 활용한 상태 관리 방법을 설명합니다.',
            metadata: { type: 'page', title: 'React Hooks 사용법' },
            similarity: 0.8,
            page_id: 'page-2',
        },
    ];

    const createLowRelevanceResults = (): similarityResponse[] => [
        {
            id: 'id-3',
            content: '오늘 날씨가 좋습니다.',
            metadata: { type: 'page', title: '날씨' },
            similarity: 0.2,
            page_id: 'page-3',
        },
    ];

    describe('runCRAGPipeline', () => {
        test('CRAG 비활성화 시 직접 검색만 수행', async () => {
            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const config = { ...DEFAULT_CRAG_CONFIG, enabled: false };

            const result = await runCRAGPipeline('React 사용법', searchFn, config);

            expect(result.route).toBe('direct');
            expect(result.results).toHaveLength(2);
            expect(searchFn).toHaveBeenCalledTimes(1);
        });

        test('단순 질문은 direct 경로로 처리', async () => {
            const searchFn = createMockSearchFn(createHighRelevanceResults());

            const result = await runCRAGPipeline('오늘 할 일', searchFn, ENABLED_CRAG_CONFIG);

            expect(result.route).toBe('direct');
            expect(searchFn).toHaveBeenCalledWith('오늘 할 일');
        });

        test('중간 복잡도 질문은 CRAG 검증 수행', async () => {
            const searchFn = createMockSearchFn(createHighRelevanceResults());

            const result = await runCRAGPipeline(
                'React 사용법 알려줘',
                searchFn,
                ENABLED_CRAG_CONFIG
            );

            expect(result.route).toBe('crag');
            expect(result.useReferences).toBe(true);
            expect(result.state.evaluation).toBeDefined();
            expect(result.state.evaluation?.grade).toBe('correct');
        });

        test('낮은 관련성이면 참조 없이 진행', async () => {
            const searchFn = createMockSearchFn(createLowRelevanceResults());

            const result = await runCRAGPipeline(
                'React 사용법 알려줘',
                searchFn,
                ENABLED_CRAG_CONFIG
            );

            expect(result.route).toBe('crag');
            expect(result.useReferences).toBe(false);
            expect(result.results).toHaveLength(0);
            expect(result.state.evaluation?.grade).toBe('incorrect');
        });

        test('비교 질문은 multi_step 경로로 처리 (다중 검색)', async () => {
            const searchFn = createMockSearchFn(createHighRelevanceResults());

            const result = await runCRAGPipeline(
                'TypeScript와 JavaScript 비교해줘',
                searchFn,
                ENABLED_CRAG_CONFIG
            );

            expect(result.route).toBe('multi_step');
            // multi_step은 서브 쿼리 수만큼 검색 호출
            expect(searchFn).toHaveBeenCalledTimes(2);
        });

        test('단계 변경 콜백 호출', async () => {
            const searchFn = createMockSearchFn(createHighRelevanceResults());
            const stages: CRAGStage[] = [];
            const onStageChange = (stage: CRAGStage) => stages.push(stage);

            await runCRAGPipeline('React 사용법', searchFn, ENABLED_CRAG_CONFIG, onStageChange);

            expect(stages).toContain('analyzing');
            expect(stages).toContain('searching');
            expect(stages).toContain('evaluating');
            expect(stages).toContain('complete');
        });

        test('검색 결과가 없으면 incorrect 평가', async () => {
            const searchFn = createMockSearchFn([]);

            const result = await runCRAGPipeline('React 사용법', searchFn, ENABLED_CRAG_CONFIG);

            expect(result.useReferences).toBe(false);
            expect(result.state.evaluation?.grade).toBe('incorrect');
        });

        test('파이프라인 상태 정보 포함', async () => {
            const searchFn = createMockSearchFn(createHighRelevanceResults());

            const result = await runCRAGPipeline('React 사용법', searchFn, ENABLED_CRAG_CONFIG);

            expect(result.state.originalQuery).toBe('React 사용법');
            expect(result.state.searchResults).toHaveLength(2);
            expect(result.state.stage).toBe('complete');
            expect(result.state.routing).toBeDefined();
        });
    });

    describe('loadCRAGConfig', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            process.env = { ...originalEnv };
        });

        afterAll(() => {
            process.env = originalEnv;
        });

        test('환경 변수에서 설정 로드', () => {
            process.env.CRAG_ENABLED = 'true';
            process.env.CRAG_RELEVANCE_THRESHOLD = '0.8';
            process.env.CRAG_AMBIGUOUS_THRESHOLD = '0.5';
            process.env.CRAG_MAX_RETRIES = '3';

            const config = loadCRAGConfig();

            expect(config.enabled).toBe(true);
            expect(config.relevanceThreshold).toBe(0.8);
            expect(config.ambiguousThreshold).toBe(0.5);
            expect(config.maxRetries).toBe(3);
        });

        test('환경 변수 없으면 기본값 사용 (opt-in이므로 disabled)', () => {
            delete process.env.CRAG_ENABLED;
            delete process.env.CRAG_RELEVANCE_THRESHOLD;

            const config = loadCRAGConfig();

            expect(config.enabled).toBe(false);
            expect(config.relevanceThreshold).toBe(0.7);
        });

        test('CRAG_ENABLED=false면 비활성화', () => {
            process.env.CRAG_ENABLED = 'false';

            const config = loadCRAGConfig();

            expect(config.enabled).toBe(false);
        });

        test('NaN 환경 변수는 기본값으로 fallback', () => {
            process.env.CRAG_ENABLED = 'true';
            process.env.CRAG_RELEVANCE_THRESHOLD = 'not-a-number';
            process.env.CRAG_AMBIGUOUS_THRESHOLD = 'invalid';
            process.env.CRAG_MAX_RETRIES = 'abc';

            const config = loadCRAGConfig();

            expect(config.relevanceThreshold).toBe(0.7);
            expect(config.ambiguousThreshold).toBe(0.4);
            expect(config.maxRetries).toBe(2);
        });

        test('threshold 순서 역전 시 기본값으로 fallback', () => {
            process.env.CRAG_ENABLED = 'true';
            process.env.CRAG_RELEVANCE_THRESHOLD = '0.3';
            process.env.CRAG_AMBIGUOUS_THRESHOLD = '0.5';

            const config = loadCRAGConfig();

            // relevance < ambiguous이면 기본값으로 복원
            expect(config.relevanceThreshold).toBe(0.7);
            expect(config.ambiguousThreshold).toBe(0.4);
        });
    });
});
