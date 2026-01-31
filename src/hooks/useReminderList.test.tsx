/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { useReminderList } from './useReminderList';

// Mock 모듈들
jest.mock('@/watermelondb/control/Alarm', () => ({
    getRemindersWithPageInfo: jest.fn(),
}));

jest.mock('@/supabase/utils/client', () => ({
    fetchUserId: jest.fn(),
}));

jest.mock('@/debug/reminder', () => ({
    reminderLogger: jest.fn(),
}));

// WatermelonDB mock 추가 - observe를 무력화
jest.mock('@/watermelondb', () => ({
    database: {
        collections: {
            get: jest.fn(() => ({
                query: jest.fn(() => ({
                    observe: jest.fn(() => ({
                        subscribe: jest.fn(() => ({
                            unsubscribe: jest.fn(),
                        })),
                    })),
                })),
            })),
        },
    },
}));

// Mock된 함수들을 가져오기
const { getRemindersWithPageInfo } = require('@/watermelondb/control/Alarm');
const { fetchUserId } = require('@/supabase/utils/client');

const mockGetRemindersWithPageInfo = getRemindersWithPageInfo as jest.MockedFunction<
    typeof getRemindersWithPageInfo
>;
const mockFetchUserId = fetchUserId as jest.MockedFunction<typeof fetchUserId>;

describe('useReminderList', () => {
    const mockUserId = 'test-user-123';
    const mockReminders = [
        {
            id: 'alarm-1',
            page_id: 'page-1',
            user_id: mockUserId,
            next_alarm_time: 1234567890,
            sent_count: 1,
            last_notification_id: 'notif-1',
            created_at: 1234567890,
            updated_at: 1234567890,
            page_title: '테스트 페이지 1',
            page_body: '테스트 내용 1',
            page_created_at: 1234567890,
            page_updated_at: 1234567890,
            page_type: 'text' as const,
            page_folder_id: null,
        },
        {
            id: 'alarm-2',
            page_id: 'page-2',
            user_id: mockUserId,
            next_alarm_time: 1234567891,
            sent_count: 2,
            last_notification_id: 'notif-2',
            created_at: 1234567891,
            updated_at: 1234567891,
            page_title: '테스트 페이지 2',
            page_body: '테스트 내용 2',
            page_created_at: 1234567891,
            page_updated_at: 1234567891,
            page_type: 'text' as const,
            page_folder_id: 'folder-1',
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchUserId.mockResolvedValue(mockUserId);
    });

    describe('초기 로드', () => {
        test('사용자 ID를 가져오고 리마인더를 로드한다', async () => {
            mockGetRemindersWithPageInfo.mockResolvedValue(mockReminders);

            const { result } = renderHook(() => useReminderList());

            // 초기 상태 확인
            expect(result.current.reminders).toEqual([]);
            expect(result.current.userId).toBeNull();

            // 사용자 ID 로드 대기
            await waitFor(() => expect(result.current.userId).toBe(mockUserId));
            expect(mockFetchUserId).toHaveBeenCalledWith('useReminderList');

            // 리마인더 로드 대기
            await waitFor(() => expect(result.current.reminders).toEqual(mockReminders));
            expect(mockGetRemindersWithPageInfo).toHaveBeenCalledWith(mockUserId, 20, 0);
            expect(result.current.hasMore).toBe(false); // 2개 < 20개 (pageSize)
            expect(result.current.totalCount).toBe(2);
        });

        test('사용자 ID 가져오기 실패 시 리마인더를 로드하지 않는다', async () => {
            mockFetchUserId.mockRejectedValue(new Error('사용자 인증 실패'));

            const { result } = renderHook(() => useReminderList());

            // 비동기 처리 한 틱 대기
            await waitFor(() => expect(true).toBe(true));

            expect(result.current.userId).toBeNull();
            expect(result.current.reminders).toEqual([]);
            expect(mockGetRemindersWithPageInfo).not.toHaveBeenCalled();
        });
    });

    describe('페이지네이션', () => {
        test('다음 페이지를 로드한다', async () => {
            const pageSize = 2;
            const firstPageData = mockReminders.slice(0, 2);
            const secondPageData = [
                {
                    ...mockReminders[0],
                    id: 'alarm-3',
                    page_id: 'page-3',
                    page_title: '테스트 페이지 3',
                },
            ];

            mockGetRemindersWithPageInfo
                .mockResolvedValueOnce(firstPageData)
                .mockResolvedValueOnce(secondPageData);

            const { result } = renderHook(() => useReminderList(pageSize));

            // 초기 로드 대기
            await waitFor(() => expect(result.current.userId).toBe(mockUserId), { timeout: 3000 });
            await waitFor(() => expect(result.current.reminders.length).toBe(2), { timeout: 3000 });

            expect(result.current.reminders).toEqual(firstPageData);
            expect(result.current.hasMore).toBe(true); // 2개 === pageSize
            expect(result.current.currentPage).toBe(0);

            // 다음 페이지 로드
            await act(async () => {
                await result.current.loadNextPage();
            });

            // 페이지 로드 후 데이터가 추가될 때까지 대기
            await waitFor(() => expect(result.current.reminders.length).toBe(3), { timeout: 3000 });

            expect(mockGetRemindersWithPageInfo).toHaveBeenLastCalledWith(
                mockUserId,
                pageSize,
                pageSize
            );
            expect(result.current.reminders).toEqual([...firstPageData, ...secondPageData]);
            expect(result.current.currentPage).toBe(1);
            expect(result.current.hasMore).toBe(false); // 1개 < pageSize
        });

        test('hasMore가 false일 때 다음 페이지를 로드하지 않는다', async () => {
            mockGetRemindersWithPageInfo.mockResolvedValue([mockReminders[0]]); // 1개만 반환

            const { result } = renderHook(() => useReminderList());

            await waitFor(() => expect(result.current.userId).toBe(mockUserId));
            await waitFor(() => expect(result.current.reminders.length).toBe(1));

            expect(result.current.hasMore).toBe(false);

            const callCount = mockGetRemindersWithPageInfo.mock.calls.length;

            await act(async () => {
                await result.current.loadNextPage();
            });

            expect(mockGetRemindersWithPageInfo).toHaveBeenCalledTimes(callCount); // 호출되지 않음
        });
    });

    describe('새로고침', () => {
        test('처음부터 다시 로드한다', async () => {
            mockGetRemindersWithPageInfo
                .mockResolvedValueOnce(mockReminders)
                .mockResolvedValueOnce([mockReminders[0]]);

            const { result } = renderHook(() => useReminderList());

            // 초기 로드
            await waitFor(() => expect(result.current.userId).toBe(mockUserId), { timeout: 3000 });
            await waitFor(() => expect(result.current.reminders.length).toBe(2), { timeout: 3000 });

            expect(result.current.reminders).toEqual(mockReminders);
            expect(result.current.totalCount).toBe(2);

            // 처음부터 다시 로드
            await act(async () => {
                await result.current.reloadFromStart();
            });

            // 새로고침 후 데이터가 업데이트될 때까지 대기
            await waitFor(() => expect(result.current.reminders.length).toBe(1), { timeout: 3000 });

            expect(mockGetRemindersWithPageInfo).toHaveBeenLastCalledWith(mockUserId, 20, 0);
            expect(result.current.reminders).toEqual([mockReminders[0]]);
            expect(result.current.currentPage).toBe(0);
            expect(result.current.totalCount).toBe(1);
            expect(result.current.hasMore).toBe(false);
        });

        test('reload 함수를 직접 호출한다', async () => {
            mockGetRemindersWithPageInfo.mockResolvedValue(mockReminders);

            const { result } = renderHook(() => useReminderList());

            await waitFor(() => expect(result.current.userId).toBe(mockUserId));
            await waitFor(() => expect(result.current.reminders).toEqual(mockReminders));

            const initialCallCount = mockGetRemindersWithPageInfo.mock.calls.length;

            // reload 호출
            await act(async () => {
                await result.current.reload(1, true); // 페이지 1, append true
            });

            expect(mockGetRemindersWithPageInfo).toHaveBeenCalledTimes(initialCallCount + 1);
            expect(mockGetRemindersWithPageInfo).toHaveBeenLastCalledWith(mockUserId, 20, 20);
        });
    });

    describe('에러 처리', () => {
        test('리마인더 로드 실패 시 에러를 처리한다', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            mockGetRemindersWithPageInfo.mockRejectedValue(new Error('데이터베이스 오류'));

            const { result } = renderHook(() => useReminderList());

            await waitFor(() => expect(result.current.userId).toBe(mockUserId));
            await waitFor(() => expect(result.current.reminders).toEqual([]));

            expect(result.current.reminders).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to load reminders:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('커스텀 페이지 크기', () => {
        test('커스텀 페이지 크기로 데이터를 로드한다', async () => {
            const customPageSize = 10;
            mockGetRemindersWithPageInfo.mockResolvedValue(mockReminders);

            const { result } = renderHook(() => useReminderList(customPageSize));

            await waitFor(() => expect(result.current.userId).toBe(mockUserId));
            await waitFor(() => expect(result.current.reminders).toEqual(mockReminders));

            expect(mockGetRemindersWithPageInfo).toHaveBeenCalledWith(
                mockUserId,
                customPageSize,
                0
            );
        });
    });
});
