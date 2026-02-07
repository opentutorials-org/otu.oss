/**
 * CRAG (Corrective Retrieval-Augmented Generation) 모듈
 *
 * Adaptive-RAG + CRAG 하이브리드 구조를 제공합니다.
 *
 * @see https://arxiv.org/abs/2401.15884 - CRAG Paper
 * @see https://arxiv.org/abs/2403.14403 - Adaptive-RAG Paper
 */

// Types
export type {
    RelevanceGrade,
    QueryComplexity,
    CRAGEvaluationResult,
    AdaptiveRoutingResult,
    CRAGPipelineState,
    CRAGStage,
    CRAGConfig,
} from './types';
export { DEFAULT_CRAG_CONFIG } from './types';

// Evaluator
export { evaluateRelevance, rewriteQuery } from './evaluator';

// Router
export { classifyQuery, determineRoute, estimateComplexityByLength } from './router';

// Pipeline
export type { CRAGPipelineResult } from './pipeline';
export { runCRAGPipeline, loadCRAGConfig } from './pipeline';
