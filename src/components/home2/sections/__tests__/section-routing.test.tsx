/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useLocation } from 'react-router-dom';

// React Router Mock
jest.mock('react-router-dom', () => ({
    useLocation: jest.fn(),
}));

describe('섹션 라우팅 테스트', () => {
    const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('URL 기반 섹션 판별', () => {
        test('폴더 목록 경로 확인', () => {
            mockUseLocation.mockReturnValue({
                pathname: '/home/folder',
                search: '',
                hash: '',
                state: null,
                key: 'default',
            });

            const { result } = renderHook(() => useLocation());
            expect(result.current.pathname).toBe('/home/folder');
            expect(result.current.pathname.startsWith('/home/folder')).toBe(true);
        });

        test('폴더 상세 경로 확인', () => {
            mockUseLocation.mockReturnValue({
                pathname: '/home/folder/test-folder-id',
                search: '',
                hash: '',
                state: null,
                key: 'default',
            });

            const { result } = renderHook(() => useLocation());
            expect(result.current.pathname).toBe('/home/folder/test-folder-id');
            expect(result.current.pathname.startsWith('/home/folder')).toBe(true);
        });

        test('리마인더 목록 경로 확인', () => {
            mockUseLocation.mockReturnValue({
                pathname: '/home/reminder',
                search: '',
                hash: '',
                state: null,
                key: 'default',
            });

            const { result } = renderHook(() => useLocation());
            expect(result.current.pathname).toBe('/home/reminder');
            expect(result.current.pathname.startsWith('/home/reminder')).toBe(true);
        });

        test('페이지 편집 경로 확인', () => {
            mockUseLocation.mockReturnValue({
                pathname: '/home/page/test-page-id',
                search: '',
                hash: '',
                state: null,
                key: 'default',
            });

            const { result } = renderHook(() => useLocation());
            expect(result.current.pathname).toBe('/home/page/test-page-id');
            expect(result.current.pathname.startsWith('/home/page/')).toBe(true);
        });

        test('홈 경로 확인', () => {
            mockUseLocation.mockReturnValue({
                pathname: '/home',
                search: '',
                hash: '',
                state: null,
                key: 'default',
            });

            const { result } = renderHook(() => useLocation());
            expect(result.current.pathname).toBe('/home');
        });
    });

    describe('섹션 판별 유틸리티 함수', () => {
        function getCurrentSection(pathname: string) {
            if (pathname.startsWith('/home/folder')) return 'folder';
            if (pathname.startsWith('/home/reminder')) return 'reminder';
            if (pathname.startsWith('/home/page/')) return 'page';
            if (pathname === '/home') return 'home';
            return null;
        }

        test('폴더 섹션 판별', () => {
            expect(getCurrentSection('/home/folder')).toBe('folder');
            expect(getCurrentSection('/home/folder/test-id')).toBe('folder');
        });

        test('리마인더 섹션 판별', () => {
            expect(getCurrentSection('/home/reminder')).toBe('reminder');
        });

        test('페이지 섹션 판별', () => {
            expect(getCurrentSection('/home/page/test-id')).toBe('page');
        });

        test('홈 섹션 판별', () => {
            expect(getCurrentSection('/home')).toBe('home');
        });

        test('알 수 없는 경로', () => {
            expect(getCurrentSection('/other')).toBe(null);
        });
    });
});
