/**
 * CRAG 파이프라인
 *
 * Adaptive-RAG + CRAG 하이브리드 구조를 통합하는 메인 모듈입니다.
 *
 * 처리 흐름:
 * 1. Adaptive 라우팅: 질문 복잡도 분석 → 처리 경로 결정
 * 2. 검색: 벡터 유사도 검색 수행
 * 3. CRAG 검증: 검색 결과 관련성 평가
 * 4. 재시도: 필요시 쿼리 재작성 후 재검색
 * 5. 결과 반환: 검증된 참조 문서 또는 빈 배열
 */

import { similarityResponse } from '@/lib/jotai';
import { chatLogger } from '@/debug/chat';
import {
    CRAGPipelineState,
    CRAGConfig,
    DEFAULT_CRAG_CONFIG,
    CRAGStage,
    CRAGEvaluationResult,
} from './types';
import { evaluateRelevance, rewriteQuery } from './evaluator';
import { determineRoute } from './router';

/**
 * CRAG 파이프라인 결과
 */
export interface CRAGPipelineResult {
    /** 최종 검색 결과 */
    results: similarityResponse[];
    /** 파이프라인 상태 */
    state: CRAGPipelineState;
    /** 참조 사용 여부 */
    useReferences: boolean;
    /** 처리 경로 */
    route: 'direct' | 'crag' | 'multi_step';
}

/**
 * CRAG 파이프라인을 실행합니다.
 *
 * @param query - 사용자 질문
 * @param searchFn - 검색 함수 (기존 getSimilarity 래핑)
 * @param config - CRAG 설정
 * @param onStageChange - 단계 변경 콜백 (UX 피드백용)
 * @returns 파이프라인 결과
 */
export async function runCRAGPipeline(
    query: string,
    searchFn: (q: string) => Promise<similarityResponse[]>,
    config: CRAGConfig = DEFAULT_CRAG_CONFIG,
    onStageChange?: (stage: CRAGStage, message?: string) => void
): Promise<CRAGPipelineResult> {
    const updateStage = (stage: CRAGStage, message?: string) => {
        state.stage = stage;
        onStageChange?.(stage, message);
        chatLogger(`CRAG stage: ${stage}`, { message });
    };

    // 초기 상태
    const state: CRAGPipelineState = {
        originalQuery: query,
        currentQuery: query,
        searchResults: [],
        retryCount: 0,
        maxRetries: config.maxRetries,
        stage: 'analyzing',
    };

    // CRAG 비활성화 시 직접 검색
    if (!config.enabled) {
        updateStage('searching');
        const results = await searchFn(query);
        updateStage('complete');
        return {
            results,
            state: { ...state, searchResults: results, stage: 'complete' },
            useReferences: results.length > 0,
            route: 'direct',
        };
    }

    // 1. Adaptive 라우팅
    updateStage('analyzing');
    const routingResult = determineRoute(query);
    state.routing = routingResult;
    chatLogger('CRAG routing result', routingResult);

    // 2. Direct 경로: 단순 질문은 기존 방식
    if (routingResult.route === 'direct') {
        updateStage('searching');
        const results = await searchFn(query);
        updateStage('complete');
        return {
            results,
            state: { ...state, searchResults: results, stage: 'complete' },
            useReferences: results.length > 0,
            route: 'direct',
        };
    }

    // 3. Multi-step 경로: 복잡 질문 (서브쿼리 분해 → 개별 검색 → 결과 병합)
    if (routingResult.route === 'multi_step' && routingResult.subQueries) {
        return await handleMultiStepRoute(
            query,
            routingResult.subQueries,
            searchFn,
            config,
            state,
            updateStage
        );
    }

    // 4. CRAG 경로: 검색 + 검증 + 재시도
    return await handleCRAGRoute(query, searchFn, config, state, updateStage);
}

/**
 * CRAG 경로를 처리합니다.
 */
async function handleCRAGRoute(
    query: string,
    searchFn: (q: string) => Promise<similarityResponse[]>,
    config: CRAGConfig,
    state: CRAGPipelineState,
    updateStage: (stage: CRAGStage, message?: string) => void
): Promise<CRAGPipelineResult> {
    let currentQuery = query;
    let results: similarityResponse[] = [];
    let evaluation: CRAGEvaluationResult | undefined;

    try {
        while (state.retryCount <= state.maxRetries) {
            // 검색 수행
            updateStage(state.retryCount === 0 ? 'searching' : 'retrying');
            results = await searchFn(currentQuery);
            state.searchResults = results;

            // 결과 평가
            updateStage('evaluating');
            evaluation = evaluateRelevance(query, results, config);
            state.evaluation = evaluation;
            chatLogger('CRAG evaluation', evaluation);

            // correct: 결과 사용
            if (evaluation.grade === 'correct') {
                updateStage('complete');
                return {
                    results,
                    state: { ...state, stage: 'complete' },
                    useReferences: true,
                    route: 'crag',
                };
            }

            // incorrect: 참조 없이 진행
            if (evaluation.grade === 'incorrect') {
                updateStage('complete');
                return {
                    results: [],
                    state: { ...state, stage: 'complete' },
                    useReferences: false,
                    route: 'crag',
                };
            }

            // ambiguous: 쿼리 재작성 후 재시도
            if (state.retryCount < state.maxRetries) {
                updateStage('rewriting');
                currentQuery = rewriteQuery(currentQuery, results);
                state.currentQuery = currentQuery;
                state.retryCount++;
                chatLogger('CRAG query rewritten', { original: query, rewritten: currentQuery });
            } else {
                break;
            }
        }

        // 최대 재시도 후에도 ambiguous이면 결과 사용
        updateStage('complete');
        return {
            results,
            state: { ...state, stage: 'complete' },
            useReferences: results.length > 0,
            route: 'crag',
        };
    } catch (error) {
        updateStage('complete');
        chatLogger('CRAG pipeline error', { query, error });
        throw error;
    }
}

/**
 * Multi-step 경로를 처리합니다 (서브쿼리별 개별 검색 + 결과 병합).
 */
async function handleMultiStepRoute(
    query: string,
    subQueries: string[],
    searchFn: (q: string) => Promise<similarityResponse[]>,
    config: CRAGConfig,
    state: CRAGPipelineState,
    updateStage: (stage: CRAGStage, message?: string) => void
): Promise<CRAGPipelineResult> {
    try {
        updateStage('searching', `Searching ${subQueries.length} sub-queries`);

        // 각 서브 쿼리에 대해 검색 수행
        const allResults: similarityResponse[] = [];
        const seenIds = new Set<string>();

        for (const subQuery of subQueries) {
            const results = await searchFn(subQuery);

            // 중복 제거하며 결과 병합
            for (const result of results) {
                const id = result.page_id || result.content?.substring(0, 50);
                if (id && !seenIds.has(id)) {
                    seenIds.add(id);
                    allResults.push(result);
                }
            }
        }

        state.searchResults = allResults;

        // 결합된 결과 평가
        updateStage('evaluating');
        const evaluation = evaluateRelevance(query, allResults, config);
        state.evaluation = evaluation;
        chatLogger('Multi-step evaluation', evaluation);

        updateStage('complete');
        return {
            results: evaluation.grade !== 'incorrect' ? allResults : [],
            state: { ...state, stage: 'complete' },
            useReferences: evaluation.grade !== 'incorrect' && allResults.length > 0,
            route: 'multi_step',
        };
    } catch (error) {
        updateStage('complete');
        chatLogger('Multi-step pipeline error', { query, error });
        throw error;
    }
}

/**
 * CRAG 설정을 환경 변수에서 로드합니다.
 * NaN 방어: 잘못된 환경 변수 값이 들어오면 기본값으로 fallback합니다.
 */
export function loadCRAGConfig(): CRAGConfig {
    const parseFloatSafe = (value: string | undefined, fallback: number): number => {
        if (!value) return fallback;
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? fallback : parsed;
    };

    const parseIntSafe = (value: string | undefined, fallback: number): number => {
        if (!value) return fallback;
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? fallback : parsed;
    };

    return {
        enabled: process.env.CRAG_ENABLED === 'true',
        relevanceThreshold: parseFloatSafe(process.env.CRAG_RELEVANCE_THRESHOLD, 0.7),
        ambiguousThreshold: parseFloatSafe(process.env.CRAG_AMBIGUOUS_THRESHOLD, 0.4),
        maxRetries: parseIntSafe(process.env.CRAG_MAX_RETRIES, 2),
        adaptiveRoutingEnabled: process.env.CRAG_ADAPTIVE_ROUTING !== 'false',
    };
}
