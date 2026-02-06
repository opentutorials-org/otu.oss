/**
 * CRAG 검색 결과 평가기
 *
 * 검색된 문서가 질문과 얼마나 관련이 있는지 평가합니다.
 * LLM을 사용하여 관련성을 판단하고, 필요시 쿼리를 재작성합니다.
 */

import { similarityResponse } from '@/lib/jotai';
import { CRAGEvaluationResult, RelevanceGrade, CRAGConfig, DEFAULT_CRAG_CONFIG } from './types';

/**
 * 검색 결과의 관련성을 평가합니다 (규칙 기반)
 *
 * 평가 기준:
 * 1. 유사도 점수 (벡터 검색에서 반환된 similarity)
 * 2. 키워드 오버랩
 * 3. 문서 수
 *
 * @param query - 원본 질문
 * @param results - 검색 결과
 * @param config - CRAG 설정
 * @returns 평가 결과
 */
export function evaluateRelevance(
    query: string,
    results: similarityResponse[],
    config: CRAGConfig = DEFAULT_CRAG_CONFIG
): CRAGEvaluationResult {
    // 검색 결과가 없으면 incorrect
    if (!results || results.length === 0) {
        return {
            grade: 'incorrect',
            score: 0,
            reason: 'No search results found',
        };
    }

    // 유사도 점수 계산 (검색 결과의 평균 유사도)
    const avgSimilarity = calculateAverageSimilarity(results);

    // 키워드 오버랩 점수 계산
    const keywordScore = calculateKeywordOverlap(query, results);

    // 최종 점수 (유사도 70%, 키워드 30%)
    const finalScore = avgSimilarity * 0.7 + keywordScore * 0.3;

    // 등급 결정
    const grade = determineGrade(finalScore, config);

    return {
        grade,
        score: finalScore,
        reason: generateReason(grade, finalScore, results.length),
    };
}

/**
 * 검색 결과의 평균 유사도를 계산합니다.
 */
function calculateAverageSimilarity(results: similarityResponse[]): number {
    if (results.length === 0) return 0;

    const totalSimilarity = results.reduce((sum, result) => {
        // similarity 필드가 있으면 사용, 없으면 0.5 기본값
        const similarity = (result as any).similarity ?? 0.5;
        return sum + similarity;
    }, 0);

    return totalSimilarity / results.length;
}

/**
 * 쿼리와 검색 결과 간의 키워드 오버랩을 계산합니다.
 */
function calculateKeywordOverlap(query: string, results: similarityResponse[]): number {
    // 쿼리에서 키워드 추출 (2자 이상의 단어)
    const queryKeywords = extractKeywords(query);
    if (queryKeywords.length === 0) return 0.5; // 키워드가 없으면 중립 점수

    // 각 결과에서 키워드 매칭 확인
    let matchedCount = 0;
    for (const keyword of queryKeywords) {
        const keywordLower = keyword.toLowerCase();
        for (const result of results) {
            const content = result.content?.toLowerCase() ?? '';
            const title = result.metadata?.title?.toLowerCase() ?? '';
            if (content.includes(keywordLower) || title.includes(keywordLower)) {
                matchedCount++;
                break; // 하나의 결과에서만 찾으면 됨
            }
        }
    }

    return matchedCount / queryKeywords.length;
}

/**
 * 텍스트에서 키워드를 추출합니다.
 */
function extractKeywords(text: string): string[] {
    // 한국어와 영어 단어 추출 (2자 이상)
    const words = text.match(/[\uAC00-\uD7A3]{2,}|[a-zA-Z]{2,}/g) || [];

    // 불용어 제거
    const stopWords = new Set([
        // 한국어 불용어
        '그리고',
        '하지만',
        '그래서',
        '그러나',
        '그런데',
        '왜냐하면',
        '때문에',
        '그것',
        '이것',
        '저것',
        '무엇',
        '어떻게',
        '언제',
        '어디',
        '누가',
        '이런',
        '저런',
        '그런',
        '어떤',
        // 영어 불용어
        'the',
        'and',
        'but',
        'or',
        'so',
        'if',
        'then',
        'what',
        'how',
        'when',
        'where',
        'who',
        'which',
        'this',
        'that',
        'these',
        'those',
    ]);

    return words.filter((word) => !stopWords.has(word.toLowerCase()));
}

/**
 * 점수를 기반으로 등급을 결정합니다.
 */
function determineGrade(score: number, config: CRAGConfig): RelevanceGrade {
    if (score >= config.relevanceThreshold) {
        return 'correct';
    } else if (score >= config.ambiguousThreshold) {
        return 'ambiguous';
    } else {
        return 'incorrect';
    }
}

/**
 * 평가 이유를 생성합니다.
 */
function generateReason(grade: RelevanceGrade, score: number, resultCount: number): string {
    const scorePercent = Math.round(score * 100);

    switch (grade) {
        case 'correct':
            return `High relevance (${scorePercent}%) with ${resultCount} matching documents`;
        case 'ambiguous':
            return `Moderate relevance (${scorePercent}%) - query rewrite may improve results`;
        case 'incorrect':
            return `Low relevance (${scorePercent}%) - proceeding without references`;
    }
}

/**
 * LLM을 사용하여 쿼리를 재작성합니다 (향후 구현)
 *
 * 현재는 간단한 규칙 기반 재작성을 수행합니다.
 *
 * @param query - 원본 쿼리
 * @param results - 검색 결과 (컨텍스트용)
 * @returns 재작성된 쿼리
 */
export function rewriteQuery(query: string, results: similarityResponse[]): string {
    // 규칙 기반 쿼리 재작성
    let rewritten = query;

    // 1. 질문 형식을 키워드 형식으로 변환
    rewritten = rewritten
        .replace(/뭐야\??$/g, '')
        .replace(/무엇인가요\??$/g, '')
        .replace(/알려줘\??$/g, '')
        .replace(/설명해줘\??$/g, '')
        .replace(/정리해줘\??$/g, '')
        .replace(/\?$/g, '')
        .trim();

    // 2. 검색 결과에서 관련 키워드 추출하여 보강
    if (results.length > 0) {
        const resultKeywords = results.flatMap((r) => extractKeywords(r.content ?? '')).slice(0, 3);

        // 원본 쿼리에 없는 관련 키워드 추가
        const queryKeywords = new Set(extractKeywords(query).map((k) => k.toLowerCase()));
        const newKeywords = resultKeywords.filter((k) => !queryKeywords.has(k.toLowerCase()));

        if (newKeywords.length > 0) {
            rewritten = `${rewritten} ${newKeywords.join(' ')}`;
        }
    }

    return rewritten;
}
