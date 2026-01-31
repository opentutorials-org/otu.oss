/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { aiOptions, DEFAULT_LLM } from './model';

describe('aiOptions', () => {
    test('최소 하나 이상의 AI 옵션이 있어야 함', () => {
        expect(aiOptions.length).toBeGreaterThan(0);
    });

    test('각 옵션은 필수 필드를 가져야 함', () => {
        aiOptions.forEach((option) => {
            expect(option).toHaveProperty('description');
            expect(option).toHaveProperty('value');
            expect(option).toHaveProperty('displayLabel');
        });
    });

    test('각 옵션의 필수 필드는 비어있지 않은 문자열이어야 함', () => {
        aiOptions.forEach((option) => {
            expect(typeof option.description).toBe('string');
            expect(option.description.length).toBeGreaterThan(0);

            expect(typeof option.value).toBe('string');
            expect(option.value.length).toBeGreaterThan(0);

            expect(typeof option.displayLabel).toBe('string');
            expect(option.displayLabel.length).toBeGreaterThan(0);
        });
    });

    test('현재 모든 옵션에 provider 필드가 있어야 함', () => {
        aiOptions.forEach((option) => {
            expect(option).toHaveProperty('provider');
            expect(typeof option.provider).toBe('string');
            expect(option.provider!.length).toBeGreaterThan(0);
        });
    });

    test('각 옵션의 value는 고유해야 함', () => {
        const values = aiOptions.map((option) => option.value);
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).toBe(values.length);
    });
});

describe('DEFAULT_LLM', () => {
    test('DEFAULT_LLM이 aiOptions에 포함되어야 함', () => {
        expect(aiOptions).toContain(DEFAULT_LLM);
    });

    test('DEFAULT_LLM은 aiOptions의 첫 번째 요소여야 함', () => {
        expect(DEFAULT_LLM).toBe(aiOptions[0]);
    });

    test('DEFAULT_LLM은 필수 필드를 가져야 함', () => {
        expect(DEFAULT_LLM).toHaveProperty('description');
        expect(DEFAULT_LLM).toHaveProperty('value');
        expect(DEFAULT_LLM).toHaveProperty('displayLabel');
    });
});
