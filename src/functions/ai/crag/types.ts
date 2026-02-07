/**
 * CRAG (Corrective Retrieval-Augmented Generation) 타입 정의
 *
 * CRAG는 검색 결과의 품질을 평가하고, 필요시 쿼리를 재작성하여
 * RAG 시스템의 응답 정확도를 향상시킵니다.
 */

import { similarityResponse } from '@/lib/jotai';

/**
 * 검색 결과 평가 등급
 * - correct: 검색 결과가 질문과 관련성이 높음 → 그대로 사용
 * - ambiguous: 관련성이 불명확함 → 쿼리 재작성 후 재검색
 * - incorrect: 관련성이 낮음 → 참조 없이 응답
 */
export type RelevanceGrade = 'correct' | 'ambiguous' | 'incorrect';

/**
 * 질문 복잡도 분류
 * - simple: 단순 질문 (예: "오늘 할 일 뭐야?") → Direct 방식 (검색 1회)
 * - moderate: 중간 복잡도 (예: "프로젝트 관련 메모 정리해줘") → CRAG 검증
 * - complex: 복잡 질문 (예: "A와 B 비교해서 정리해줘") → Multi-step (서브쿼리 분해 후 개별 검색)
 */
export type QueryComplexity = 'simple' | 'moderate' | 'complex';

/**
 * CRAG 검증 결과
 */
export interface CRAGEvaluationResult {
    /** 검색 결과 평가 등급 */
    grade: RelevanceGrade;
    /** 평가 점수 (0-1) */
    score: number;
    /** 평가 이유 */
    reason: string;
    /** 재작성된 쿼리 (grade가 ambiguous인 경우) */
    rewrittenQuery?: string;
}

/**
 * Adaptive 라우팅 결과 (discriminated union)
 *
 * complexity-route 매핑이 타입 레벨에서 보장됩니다:
 * - simple → direct (단순 검색)
 * - moderate → crag (CRAG 검증)
 * - complex → multi_step (다중 서브쿼리 검색 + 결과 병합)
 */
export type AdaptiveRoutingResult =
    | { complexity: 'simple'; route: 'direct' }
    | { complexity: 'moderate'; route: 'crag' }
    | { complexity: 'complex'; route: 'multi_step'; subQueries: string[] };

/**
 * CRAG 파이프라인 상태
 */
export interface CRAGPipelineState {
    /** 원본 질문 */
    originalQuery: string;
    /** 현재 쿼리 (재작성된 경우 다름) */
    currentQuery: string;
    /** 검색 결과 */
    searchResults: similarityResponse[];
    /** CRAG 평가 결과 */
    evaluation?: CRAGEvaluationResult;
    /** 라우팅 결과 */
    routing?: AdaptiveRoutingResult;
    /** 재시도 횟수 */
    retryCount: number;
    /** 최대 재시도 횟수 */
    maxRetries: number;
    /** 처리 단계 (UX 피드백용) */
    stage: CRAGStage;
}

/**
 * CRAG 처리 단계 (UI 피드백용)
 */
export type CRAGStage =
    | 'analyzing' // 질문 분석 중
    | 'searching' // 검색 중
    | 'evaluating' // 결과 평가 중
    | 'rewriting' // 쿼리 재작성 중
    | 'retrying' // 재검색 중
    | 'generating' // 응답 생성 중
    | 'complete'; // 완료

/**
 * CRAG 설정
 */
export interface CRAGConfig {
    /** CRAG 활성화 여부 */
    enabled: boolean;
    /** 관련성 평가 임계값 (이 값 이상이면 correct) */
    relevanceThreshold: number;
    /** ambiguous 판정 임계값 (이 값 이상이면 ambiguous, 미만이면 incorrect) */
    ambiguousThreshold: number;
    /** 최대 재시도 횟수 */
    maxRetries: number;
    /** Adaptive 라우팅 활성화 여부 */
    adaptiveRoutingEnabled: boolean;
}

/**
 * 기본 CRAG 설정
 */
export const DEFAULT_CRAG_CONFIG: CRAGConfig = {
    enabled: false,
    relevanceThreshold: 0.7,
    ambiguousThreshold: 0.4,
    maxRetries: 2,
    adaptiveRoutingEnabled: true,
};
