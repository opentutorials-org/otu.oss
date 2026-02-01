/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MAX_TEXT_LENGTH } from '@/functions/validation/textLength';

// Jotai 모킹
jest.mock('jotai', () => ({
    ...jest.requireActual('jotai'),
    getDefaultStore: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        sub: jest.fn(),
    })),
}));

// navigation utils 모킹
jest.mock('@/utils/navigation', () => ({
    navigateWithState: jest.fn(),
    getNavigationState: jest.fn(),
}));

// WebViewCommunicator 모킹
jest.mock('@/components/core/WebViewCommunicator', () => ({
    WebViewCommunicator: jest.fn(),
}));

// linkify 함수 모킹
jest.mock('@/functions/linkify', () => ({
    linkify: jest.fn((text) => text),
}));

import { LinkifiedTitle } from '../LinkifiedTitle';

describe('LinkifiedTitle', () => {
    const mockOnTitleChange = jest.fn();
    const defaultProps = {
        title: '',
        onTitleChange: mockOnTitleChange,
        placeholder: '제목 없음',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('길이 제한', () => {
        it('TextareaAutosize에 maxLength prop이 설정되어야 함', () => {
            const { container } = render(<LinkifiedTitle {...defaultProps} />);

            // 편집 모드 활성화
            const titleDiv = container.querySelector('.cursor-text');
            expect(titleDiv).not.toBeNull();
            fireEvent.click(titleDiv!);

            // textarea 확인
            const textarea = container.querySelector('textarea');
            expect(textarea).not.toBeNull();
            expect(textarea).toHaveAttribute('maxLength', String(MAX_TEXT_LENGTH));
        });

        it('50,000자 이하의 제목은 정상적으로 표시되어야 함', () => {
            const shortTitle = 'a'.repeat(1000);
            const { container } = render(<LinkifiedTitle {...defaultProps} title={shortTitle} />);

            // 편집 모드 활성화
            const titleDiv = container.querySelector('.cursor-text');
            fireEvent.click(titleDiv!);

            // textarea 값 확인
            const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
            expect(textarea.value).toBe(shortTitle);
            expect(textarea.value.length).toBe(1000);
        });

        it('정확히 50,000자의 제목은 허용되어야 함', () => {
            const maxLengthTitle = 'a'.repeat(MAX_TEXT_LENGTH);
            const { container } = render(
                <LinkifiedTitle {...defaultProps} title={maxLengthTitle} />
            );

            // 편집 모드 활성화
            const titleDiv = container.querySelector('.cursor-text');
            fireEvent.click(titleDiv!);

            // textarea 값 확인
            const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
            expect(textarea.value.length).toBe(MAX_TEXT_LENGTH);
        });
    });

    describe('기본 동작', () => {
        it('placeholder가 표시되어야 함', () => {
            render(<LinkifiedTitle {...defaultProps} />);
            expect(screen.getByText('제목 없음')).toBeInTheDocument();
        });

        it('제목이 표시되어야 함', () => {
            const { container } = render(<LinkifiedTitle {...defaultProps} title="테스트 제목" />);
            expect(container.textContent).toContain('테스트 제목');
        });

        it('클릭 시 편집 모드로 전환되어야 함', () => {
            const { container } = render(<LinkifiedTitle {...defaultProps} />);

            const titleDiv = container.querySelector('.cursor-text');
            fireEvent.click(titleDiv!);

            const textarea = container.querySelector('textarea');
            expect(textarea).not.toBeNull();
        });

        it('입력 시 onTitleChange 콜백이 호출되어야 함', () => {
            const { container } = render(<LinkifiedTitle {...defaultProps} />);

            // 편집 모드 활성화
            const titleDiv = container.querySelector('.cursor-text');
            fireEvent.click(titleDiv!);

            // 입력
            const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
            fireEvent.change(textarea, { target: { value: '새 제목' } });

            expect(mockOnTitleChange).toHaveBeenCalledWith('새 제목');
        });
    });

    describe('autoFocus', () => {
        it('autoFocus prop이 true일 때 초기 렌더링 시 편집 모드여야 함', () => {
            const { container } = render(<LinkifiedTitle {...defaultProps} autoFocus={true} />);

            // textarea가 바로 존재해야 함 (편집 모드로 시작했는지 확인)
            const textarea = container.querySelector('textarea');
            expect(textarea).not.toBeNull();
        });

        it('autoFocus prop이 false(기본값)일 때 초기 렌더링 시 보기 모드여야 함', () => {
            const { container } = render(<LinkifiedTitle {...defaultProps} />);

            // textarea가 없어야 함
            const textarea = container.querySelector('textarea');
            expect(textarea).toBeNull();

            // 보기 모드 div가 있어야 함
            const titleDiv = container.querySelector('.cursor-text');
            expect(titleDiv).not.toBeNull();
        });
    });
});
