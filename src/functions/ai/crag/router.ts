/**
 * Adaptive RAG 라우터
 *
 * 질문의 복잡도를 분석하여 적절한 처리 경로를 결정합니다.
 * - simple: 직접 검색 (기존 방식)
 * - moderate: CRAG 검증
 * - complex: Multi-step (서브쿼리 분해 → 개별 검색 → 결과 병합)
 */

import { AdaptiveRoutingResult, QueryComplexity } from './types';

/**
 * 질문 복잡도 패턴
 */
const COMPLEXITY_PATTERNS = {
    // 단순 질문 패턴
    simple: [
        /^(오늘|내일|어제)\s*(할\s*일|일정|계획)/, // 일정 관련
        /^(뭐|무엇)\s*해?야?\s*(해|하지|할까)/, // 단순 what 질문
        /^(언제|어디|누구|몇)/, // 단순 wh-질문
        /메모\s*(보여|알려)/, // 메모 조회
    ],
    // 복잡 질문 패턴
    complex: [
        /(.+)(와|과|랑)\s*(.+)\s*(비교|차이|다른\s*점)/, // 비교 질문
        /(.+)(와|과|랑)\s*(.+)\s*(연결|관계|연관)/, // 관계 질문
        /(장단점|pros\s*and\s*cons)/i, // 장단점 분석
        /종합|통합|전체적|요약해서/, // 종합 분석
        /(.+)(이고|하고)\s*(.+)(이면|하면)\s*(.+)/, // 조건부 복합 질문
    ],
};

/**
 * 질문을 분석하여 복잡도를 분류합니다.
 *
 * @param query - 사용자 질문
 * @returns 라우팅 결과
 */
export function classifyQuery(query: string): AdaptiveRoutingResult {
    const normalizedQuery = query.trim().toLowerCase();

    // 1. 단순 질문 체크
    for (const pattern of COMPLEXITY_PATTERNS.simple) {
        if (pattern.test(normalizedQuery)) {
            return {
                complexity: 'simple',
                route: 'direct',
            };
        }
    }

    // 2. 복잡 질문 체크
    for (const pattern of COMPLEXITY_PATTERNS.complex) {
        if (pattern.test(normalizedQuery)) {
            const subQueries = extractSubQueries(query);
            return {
                complexity: 'complex',
                route: 'multi_step',
                subQueries,
            };
        }
    }

    // 3. 기본: 중간 복잡도 (CRAG 검증)
    return {
        complexity: 'moderate',
        route: 'crag',
    };
}

/**
 * 복잡 질문에서 서브 쿼리를 추출합니다.
 *
 * 예: "React와 Vue 비교해줘" → ["React", "Vue"]
 * 서브쿼리를 추출할 수 없는 경우 원본 쿼리를 반환합니다.
 */
function extractSubQueries(query: string): string[] {
    // 비교 패턴: A와 B 비교
    const compareMatch = query.match(/(.+?)(와|과|랑)\s*(.+?)\s*(비교|차이|다른\s*점)/);
    if (compareMatch) {
        return [compareMatch[1].trim(), compareMatch[3].trim()];
    }

    // 관계 패턴: A와 B의 관계
    const relationMatch = query.match(/(.+?)(와|과|랑)\s*(.+?)\s*(연결|관계|연관)/);
    if (relationMatch) {
        return [relationMatch[1].trim(), relationMatch[3].trim()];
    }

    // 서브쿼리를 추출할 수 없으면 원본 쿼리를 단일 항목으로 반환
    return [query];
}

/**
 * 쿼리 길이를 기반으로 복잡도를 추정합니다.
 */
export function estimateComplexityByLength(query: string): QueryComplexity {
    const length = query.trim().length;

    if (length < 20) {
        return 'simple';
    } else if (length < 50) {
        return 'moderate';
    } else {
        return 'complex';
    }
}

/**
 * 여러 팩터를 종합하여 최종 라우팅을 결정합니다.
 *
 * @param query - 사용자 질문
 * @param hasHistory - 대화 히스토리 존재 여부
 * @returns 라우팅 결과
 */
export function determineRoute(query: string, hasHistory: boolean = false): AdaptiveRoutingResult {
    const patternResult = classifyQuery(query);

    // 패턴 매칭 결과가 simple이면 그대로 사용
    if (patternResult.complexity === 'simple') {
        return patternResult;
    }

    // 대화 히스토리가 있으면 컨텍스트 의존 질문일 가능성이 높음
    if (hasHistory && patternResult.complexity === 'moderate') {
        // 히스토리 기반 질문은 CRAG 검증 수행
        return {
            ...patternResult,
            route: 'crag',
        };
    }

    return patternResult;
}
