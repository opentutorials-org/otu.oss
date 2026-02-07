/**
 * Langfuse 통합 모듈
 *
 * LLM/RAG 시스템의 품질 모니터링 및 평가를 위한 Langfuse 통합입니다.
 *
 * 주요 기능:
 * - RAG 파이프라인 트레이싱
 * - RAGAS 평가 메트릭 기록
 * - 사용자 피드백 수집
 * - 토큰 사용량 모니터링
 *
 * @see https://langfuse.com/docs
 */

// Config
export {
    loadLangfuseConfig,
    getLangfuse,
    isLangfuseEnabled,
    getLangfuseDisabledReason,
    shutdownLangfuse,
} from './config';
export type { LangfuseConfig } from './config';

// Tracing
export { startRAGTrace, traceLLMCall } from './tracing';
export type {
    RAGTraceInput,
    RAGTraceHandle,
    RetrievalSpanParams,
    CRAGSpanParams,
    GenerationSpanParams,
    TraceCompleteParams,
} from './tracing';

// Metrics
export { recordScore, recordRAGASMetrics, recordUserFeedback, recordUsage } from './metrics';
export type { RAGASMetrics, ScoreInput, UsageStats } from './metrics';
