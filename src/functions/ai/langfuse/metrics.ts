/**
 * Langfuse 평가 메트릭
 *
 * RAG 시스템의 품질 평가 점수를 Langfuse에 기록합니다.
 * RAGAS 메트릭 통합을 위한 인터페이스를 제공합니다.
 */

import { getLangfuse, isLangfuseEnabled } from './config';
import { aiLogger } from '@/debug/ai';

/**
 * RAGAS 평가 메트릭
 */
export interface RAGASMetrics {
    /** Faithfulness: 응답이 검색된 컨텍스트에 기반하는가 (0-1) */
    faithfulness?: number;
    /** Answer Relevancy: 응답이 질문에 적절한가 (0-1) */
    answerRelevancy?: number;
    /** Context Precision: 검색된 문서 중 관련 문서 비율 (0-1) */
    contextPrecision?: number;
    /** Context Recall: 필요한 정보가 모두 검색되었는가 (0-1) */
    contextRecall?: number;
}

/**
 * 평가 점수 기록 인터페이스
 */
export interface ScoreInput {
    /** 트레이스 ID */
    traceId: string;
    /** 메트릭 이름 */
    name: string;
    /** 점수 값 (0-1) */
    value: number;
    /** 코멘트 */
    comment?: string;
    /** 데이터 포인트 ID (선택) */
    dataPointId?: string;
}

/**
 * Langfuse에 평가 점수를 기록합니다.
 */
export function recordScore(input: ScoreInput): void {
    if (!isLangfuseEnabled()) {
        return;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
        return;
    }

    langfuse.score({
        traceId: input.traceId,
        name: input.name,
        value: input.value,
        comment: input.comment,
    });

    // 비동기로 전송
    langfuse.flushAsync().catch((error) => {
        aiLogger('Langfuse flush failed: %s', error?.message);
    });
}

/**
 * RAGAS 메트릭을 Langfuse에 기록합니다.
 */
export function recordRAGASMetrics(traceId: string, metrics: RAGASMetrics): void {
    if (!isLangfuseEnabled()) {
        return;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
        return;
    }

    // 각 메트릭을 개별 점수로 기록
    if (metrics.faithfulness !== undefined) {
        langfuse.score({
            traceId,
            name: 'ragas-faithfulness',
            value: metrics.faithfulness,
            comment: 'RAGAS: 응답이 컨텍스트에 기반하는 정도',
        });
    }

    if (metrics.answerRelevancy !== undefined) {
        langfuse.score({
            traceId,
            name: 'ragas-answer-relevancy',
            value: metrics.answerRelevancy,
            comment: 'RAGAS: 응답이 질문에 적절한 정도',
        });
    }

    if (metrics.contextPrecision !== undefined) {
        langfuse.score({
            traceId,
            name: 'ragas-context-precision',
            value: metrics.contextPrecision,
            comment: 'RAGAS: 검색된 문서의 관련성',
        });
    }

    if (metrics.contextRecall !== undefined) {
        langfuse.score({
            traceId,
            name: 'ragas-context-recall',
            value: metrics.contextRecall,
            comment: 'RAGAS: 필요한 정보의 검색 완전성',
        });
    }

    // 비동기로 전송
    langfuse.flushAsync().catch((error) => {
        aiLogger('Langfuse flush failed: %s', error?.message);
    });
}

/**
 * 사용자 피드백을 기록합니다.
 */
export function recordUserFeedback(
    traceId: string,
    feedback: {
        /** 피드백 유형 (thumbs up/down) */
        type: 'positive' | 'negative';
        /** 추가 코멘트 */
        comment?: string;
    }
): void {
    if (!isLangfuseEnabled()) {
        return;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
        return;
    }

    langfuse.score({
        traceId,
        name: 'user-feedback',
        value: feedback.type === 'positive' ? 1 : 0,
        comment: feedback.comment,
    });

    // 비동기로 전송
    langfuse.flushAsync().catch((error) => {
        aiLogger('Langfuse flush failed: %s', error?.message);
    });
}

/**
 * 토큰 사용량 및 비용 통계
 */
export interface UsageStats {
    /** 프롬프트 토큰 수 */
    promptTokens: number;
    /** 완료 토큰 수 */
    completionTokens: number;
    /** 총 토큰 수 */
    totalTokens: number;
    /** 예상 비용 (USD) */
    estimatedCostUsd?: number;
}

/**
 * 토큰 사용량을 기록합니다.
 */
export function recordUsage(
    traceId: string,
    model: string,
    usage: UsageStats,
    metadata?: Record<string, unknown>
): void {
    if (!isLangfuseEnabled()) {
        return;
    }

    const langfuse = getLangfuse();
    if (!langfuse) {
        return;
    }

    // 사용량 정보를 트레이스에 추가
    langfuse.span({
        traceId,
        name: 'token-usage',
        metadata: {
            model,
            ...usage,
            ...metadata,
        },
    });

    // 비동기로 전송
    langfuse.flushAsync().catch((error) => {
        aiLogger('Langfuse flush failed: %s', error?.message);
    });
}
