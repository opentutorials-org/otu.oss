/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { evaluateRelevance, rewriteQuery } from '../evaluator';
import { DEFAULT_CRAG_CONFIG } from '../types';
import { similarityResponse } from '@/lib/jotai';

describe('CRAG Evaluator', () => {
    describe('evaluateRelevance', () => {
        const createMockResult = (
            content: string,
            title: string,
            similarity: number = 0.7
        ): similarityResponse => ({
            id: `id-${Math.random()}`,
            content,
            metadata: { type: 'page', title },
            similarity,
            page_id: `page-${Math.random()}`,
        });

        test('검색 결과가 없으면 incorrect 등급 반환', () => {
            const result = evaluateRelevance('React 사용법', []);

            expect(result.grade).toBe('incorrect');
            expect(result.score).toBe(0);
            expect(result.reason).toContain('No search results');
        });

        test('높은 유사도와 키워드 매칭이 있으면 correct 등급 반환', () => {
            const results = [
                createMockResult(
                    'React는 Facebook이 개발한 UI 라이브러리입니다.',
                    'React 소개',
                    0.85
                ),
                createMockResult(
                    'React Hooks를 사용하면 함수 컴포넌트에서도 상태를 관리할 수 있습니다.',
                    'React Hooks',
                    0.8
                ),
            ];

            const result = evaluateRelevance('React 사용법', results);

            expect(result.grade).toBe('correct');
            expect(result.score).toBeGreaterThanOrEqual(0.7);
        });

        test('중간 유사도이면 ambiguous 등급 반환', () => {
            // 유사도 0.55 + 키워드 매칭 50% (React 포함)
            // 0.55 * 0.7 + 0.5 * 0.3 = 0.385 + 0.15 = 0.535 (ambiguous 범위)
            const results = [createMockResult('React 프레임워크 소개', 'React 프레임워크', 0.55)];

            const result = evaluateRelevance('React 사용법', results);

            expect(result.grade).toBe('ambiguous');
            expect(result.score).toBeGreaterThanOrEqual(0.4);
            expect(result.score).toBeLessThan(0.7);
        });

        test('낮은 유사도이면 incorrect 등급 반환', () => {
            const results = [createMockResult('오늘의 날씨는 맑습니다.', '날씨 정보', 0.2)];

            const result = evaluateRelevance('React 사용법', results);

            expect(result.grade).toBe('incorrect');
            expect(result.score).toBeLessThan(0.4);
        });

        test('커스텀 설정 사용 가능', () => {
            const results = [createMockResult('React 기초', 'React', 0.65)];
            const customConfig = {
                ...DEFAULT_CRAG_CONFIG,
                relevanceThreshold: 0.6, // 낮은 임계값
            };

            const result = evaluateRelevance('React 사용법', results, customConfig);

            expect(result.grade).toBe('correct');
        });

        test('키워드 오버랩이 점수에 영향을 줌', () => {
            // 동일한 유사도이지만 키워드 매칭이 다른 경우
            const resultsWithKeyword = [
                createMockResult('React 컴포넌트 사용법을 알아봅시다', 'React 사용법', 0.6),
            ];
            const resultsWithoutKeyword = [
                createMockResult('프론트엔드 개발 가이드', '개발 가이드', 0.6),
            ];

            const scoreWithKeyword = evaluateRelevance('React 사용법', resultsWithKeyword).score;
            const scoreWithoutKeyword = evaluateRelevance(
                'React 사용법',
                resultsWithoutKeyword
            ).score;

            expect(scoreWithKeyword).toBeGreaterThan(scoreWithoutKeyword);
        });
    });

    describe('rewriteQuery', () => {
        test('질문 형식을 키워드 형식으로 변환', () => {
            const result = rewriteQuery('React 사용법이 뭐야?', []);

            expect(result).not.toContain('뭐야');
            expect(result).not.toContain('?');
            expect(result).toContain('React');
        });

        test('질문 종결어미 제거', () => {
            expect(rewriteQuery('React 설명해줘', [])).not.toContain('설명해줘');
            expect(rewriteQuery('React 알려줘', [])).not.toContain('알려줘');
            expect(rewriteQuery('React 정리해줘', [])).not.toContain('정리해줘');
        });

        test('검색 결과에서 관련 키워드 추출하여 보강', () => {
            const results: similarityResponse[] = [
                {
                    id: 'id-rewrite',
                    content: 'React Hooks와 useState를 사용한 상태 관리',
                    metadata: { type: 'page', title: 'React Hooks' },
                    similarity: 0.7,
                    page_id: 'page-rewrite',
                },
            ];

            const result = rewriteQuery('React 기초', results);

            // 원본 키워드 유지
            expect(result).toContain('React');
        });

        test('빈 쿼리 처리', () => {
            const result = rewriteQuery('', []);
            expect(result).toBe('');
        });
    });
});
