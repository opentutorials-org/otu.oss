/**
 * @jest-environment jsdom
 */

import { MAX_TEXT_LENGTH, isTextLengthValid, truncateText } from '../textLength';

describe('textLength validation', () => {
    describe('MAX_TEXT_LENGTH constant', () => {
        it('should be 50000', () => {
            expect(MAX_TEXT_LENGTH).toBe(50000);
        });
    });

    describe('isTextLengthValid', () => {
        it('should return true for text within limit', () => {
            const text = 'a'.repeat(1000);
            expect(isTextLengthValid(text)).toBe(true);
        });

        it('should return true for empty text', () => {
            expect(isTextLengthValid('')).toBe(true);
        });

        it('should return true for text exactly at limit', () => {
            const text = 'a'.repeat(50000);
            expect(isTextLengthValid(text)).toBe(true);
        });

        it('should return false for text exceeding limit', () => {
            const text = 'a'.repeat(50001);
            expect(isTextLengthValid(text)).toBe(false);
        });

        it('should handle undefined input', () => {
            expect(isTextLengthValid(undefined as any)).toBe(true);
        });

        it('should handle null input', () => {
            expect(isTextLengthValid(null as any)).toBe(true);
        });
    });

    describe('truncateText', () => {
        it('should not truncate text within limit', () => {
            const text = 'hello world';
            expect(truncateText(text)).toBe(text);
        });

        it('should truncate text exceeding limit', () => {
            const text = 'a'.repeat(50001);
            const truncated = truncateText(text);
            expect(truncated.length).toBe(50000);
            expect(truncated).toBe('a'.repeat(50000));
        });

        it('should return empty string for empty input', () => {
            expect(truncateText('')).toBe('');
        });

        it('should handle undefined input', () => {
            expect(truncateText(undefined as any)).toBe('');
        });

        it('should handle null input', () => {
            expect(truncateText(null as any)).toBe('');
        });
    });
});
