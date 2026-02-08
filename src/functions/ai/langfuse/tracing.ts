/**
 * Langfuse 트레이싱 유틸리티
 *
 * RAG 파이프라인의 각 단계를 추적합니다.
 * - 검색 (Retrieval)
 * - CRAG 검증 (Evaluation)
 * - LLM 생성 (Generation)
 */

import { getLangfuse, isLangfuseEnabled } from './config';
import { aiLogger } from '@/debug/ai';
import type { CRAGPipelineResult } from '../crag/pipeline';

/**
 * RAG 트레이스 생성
 */
export interface RAGTraceInput {
    /** 사용자 ID */
    userId: string;
    /** 세션 ID */
    sessionId?: string;
    /** 사용자 질문 */
    query: string;
    /** 메타데이터 */
    metadata?: Record<string, unknown>;
}

/**
 * RAG 트레이스 핸들
 */
export interface RAGTraceHandle {
    /** 트레이스 ID */
    traceId: string;
    /** 검색 단계 기록 */
    logRetrieval: (params: RetrievalSpanParams) => void;
    /** CRAG 검증 단계 기록 */
    logCRAGEvaluation: (params: CRAGSpanParams) => void;
    /** LLM 생성 단계 기록 */
    logGeneration: (params: GenerationSpanParams) => void;
    /** 트레이스 완료 */
    complete: (params?: TraceCompleteParams) => Promise<void>;
}

export interface RetrievalSpanParams {
    /** 검색 쿼리 */
    query: string;
    /** 검색 결과 수 */
    resultCount: number;
    /** 검색 소요 시간 (ms) */
    latencyMs: number;
    /** 검색 결과 */
    results?: Array<{ content: string; similarity: number }>;
}

export interface CRAGSpanParams {
    /** CRAG 파이프라인 결과 */
    pipelineResult: CRAGPipelineResult;
    /** 소요 시간 (ms) */
    latencyMs: number;
}

export interface GenerationSpanParams {
    /** 사용 모델 */
    model: string;
    /** 프롬프트 */
    prompt: string;
    /** 응답 */
    completion: string;
    /** 토큰 사용량 */
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    /** 소요 시간 (ms) */
    latencyMs: number;
}

export interface TraceCompleteParams {
    /** 사용자 피드백 점수 (0-1, recordUserFeedback과 동일 스케일) */
    score?: number;
    /** 피드백 코멘트 */
    comment?: string;
}

/**
 * Langfuse가 비활성화된 경우 사용할 노옵(no-op) 핸들
 */
const noopTraceHandle: RAGTraceHandle = {
    traceId: 'noop',
    logRetrieval: () => {},
    logCRAGEvaluation: () => {},
    logGeneration: () => {},
    complete: async () => {},
};

/**
 * RAG 트레이스를 시작합니다.
 *
 * @param input - 트레이스 입력 정보
 * @returns 트레이스 핸들 (Langfuse 비활성화 시 no-op 핸들 반환)
 */
export function startRAGTrace(input: RAGTraceInput): RAGTraceHandle {
    if (!isLangfuseEnabled()) {
        return noopTraceHandle;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
        return noopTraceHandle;
    }

    // 트레이스 생성
    const trace = langfuse.trace({
        name: 'rag-pipeline',
        userId: input.userId,
        sessionId: input.sessionId,
        input: { query: input.query },
        metadata: input.metadata,
    });

    const traceId = trace.id;

    return {
        traceId,

        logRetrieval: (params: RetrievalSpanParams) => {
            trace.span({
                name: 'retrieval',
                input: { query: params.query },
                output: {
                    resultCount: params.resultCount,
                    results: params.results?.map((r) => ({
                        preview: r.content.substring(0, 100),
                        similarity: r.similarity,
                    })),
                },
                metadata: {
                    latencyMs: params.latencyMs,
                },
            });
        },

        logCRAGEvaluation: (params: CRAGSpanParams) => {
            const { pipelineResult } = params;
            trace.span({
                name: 'crag-evaluation',
                input: {
                    originalQuery: pipelineResult.state.originalQuery,
                    currentQuery: pipelineResult.state.currentQuery,
                },
                output: {
                    route: pipelineResult.route,
                    useReferences: pipelineResult.useReferences,
                    grade: pipelineResult.state.evaluation?.grade,
                    score: pipelineResult.state.evaluation?.score,
                    retryCount: pipelineResult.state.retryCount,
                },
                metadata: {
                    latencyMs: params.latencyMs,
                    complexity: pipelineResult.state.routing?.complexity,
                },
            });
        },

        logGeneration: (params: GenerationSpanParams) => {
            trace.generation({
                name: 'llm-generation',
                model: params.model,
                input: params.prompt,
                output: params.completion,
                usage: params.usage,
                metadata: {
                    latencyMs: params.latencyMs,
                },
            });
        },

        complete: async (params?: TraceCompleteParams) => {
            if (params?.score !== undefined) {
                trace.score({
                    name: 'user-feedback',
                    value: params.score,
                    comment: params.comment,
                });
            }

            // 트레이스 데이터 전송
            await langfuse.flushAsync().catch((error) => {
                aiLogger('Langfuse flush failed: %s', error?.message);
            });
        },
    };
}

/**
 * 간단한 LLM 호출 트레이싱 (RAG 없이)
 */
export function traceLLMCall(params: {
    userId: string;
    model: string;
    prompt: string;
    completion: string;
    usage?: GenerationSpanParams['usage'];
    latencyMs: number;
    metadata?: Record<string, unknown>;
}): void {
    if (!isLangfuseEnabled()) {
        return;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
        return;
    }

    langfuse.generation({
        name: 'llm-call',
        model: params.model,
        input: params.prompt,
        output: params.completion,
        usage: params.usage,
        metadata: {
            userId: params.userId,
            latencyMs: params.latencyMs,
            ...params.metadata,
        },
    });

    // 비동기로 전송 (에러 무시)
    langfuse.flushAsync().catch((error) => {
        aiLogger('Langfuse flush failed: %s', error?.message);
    });
}
