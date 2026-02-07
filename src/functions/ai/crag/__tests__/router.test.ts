/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { classifyQuery, determineRoute, estimateComplexityByLength } from '../router';

describe('CRAG Router', () => {
    describe('classifyQuery', () => {
        describe('단순 질문 분류', () => {
            test('일정 관련 질문은 simple로 분류', () => {
                expect(classifyQuery('오늘 할 일').complexity).toBe('simple');
                expect(classifyQuery('내일 일정').complexity).toBe('simple');
                expect(classifyQuery('오늘 할 일 뭐야').complexity).toBe('simple');
            });

            test('단순 what 질문은 simple로 분류', () => {
                expect(classifyQuery('뭐 해야해').complexity).toBe('simple');
                expect(classifyQuery('뭐 할까').complexity).toBe('simple');
            });

            test('wh-질문은 simple로 분류', () => {
                expect(classifyQuery('언제 회의야').complexity).toBe('simple');
                expect(classifyQuery('어디서 만나').complexity).toBe('simple');
                expect(classifyQuery('누구랑 갔어').complexity).toBe('simple');
            });

            test('메모 조회 질문은 simple로 분류', () => {
                expect(classifyQuery('메모 보여줘').complexity).toBe('simple');
                expect(classifyQuery('메모 알려줘').complexity).toBe('simple');
            });
        });

        describe('복잡 질문 분류', () => {
            test('비교 질문은 complex로 분류', () => {
                const result = classifyQuery('React와 Vue 비교해줘');
                expect(result.complexity).toBe('complex');
                expect(result.route).toBe('multi_step');
                if (result.complexity === 'complex') {
                    expect(result.subQueries).toContain('React');
                    expect(result.subQueries).toContain('Vue');
                }
            });

            test('차이점 질문은 complex로 분류', () => {
                const result = classifyQuery('TypeScript와 JavaScript의 차이점');
                expect(result.complexity).toBe('complex');
                if (result.complexity === 'complex') {
                    expect(result.subQueries).toBeDefined();
                }
            });

            test('장단점 질문은 complex로 분류', () => {
                expect(classifyQuery('React의 장단점').complexity).toBe('complex');
            });

            test('종합 분석 질문은 complex로 분류', () => {
                expect(classifyQuery('프로젝트 전체적으로 요약해줘').complexity).toBe('complex');
            });
        });

        describe('중간 복잡도 분류', () => {
            test('일반적인 질문은 moderate로 분류', () => {
                expect(classifyQuery('React 사용법 알려줘').complexity).toBe('moderate');
                expect(classifyQuery('프로젝트 구조 설명해줘').complexity).toBe('moderate');
            });

            test('moderate 질문은 crag 경로 사용', () => {
                const result = classifyQuery('React 사용법 알려줘');
                expect(result.route).toBe('crag');
            });
        });
    });

    describe('determineRoute', () => {
        test('simple 패턴 매칭 시 direct 경로 반환', () => {
            const result = determineRoute('오늘 할 일');
            expect(result.route).toBe('direct');
        });

        test('complex 패턴 매칭 시 multi_step 경로 반환', () => {
            const result = determineRoute('React와 Vue 비교');
            expect(result.route).toBe('multi_step');
        });

        test('moderate 질문은 crag 경로 반환', () => {
            const result = determineRoute('React 사용법');
            expect(result.route).toBe('crag');
        });

        test('대화 히스토리가 있어도 moderate는 crag 유지', () => {
            const result = determineRoute('React 사용법', true);
            expect(result.route).toBe('crag');
        });
    });

    describe('estimateComplexityByLength', () => {
        test('짧은 쿼리는 simple로 추정', () => {
            expect(estimateComplexityByLength('오늘 할일')).toBe('simple');
        });

        test('중간 길이 쿼리는 moderate로 추정', () => {
            expect(estimateComplexityByLength('React를 사용해서 컴포넌트를 만드는 방법')).toBe(
                'moderate'
            );
        });

        test('긴 쿼리는 complex로 추정', () => {
            const longQuery =
                'React와 Vue를 비교해서 각각의 장단점을 정리하고, 어떤 상황에서 어떤 프레임워크를 선택해야 하는지 가이드를 만들어줘';
            expect(estimateComplexityByLength(longQuery)).toBe('complex');
        });
    });
});
