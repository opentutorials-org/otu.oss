'use client';

import React, { useEffect, useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useReminderList } from '@/hooks/useReminderList';
import {
    selectedItemsState,
    selectionModeState,
    toggleItemSelection,
    refreshSeedAfterContentUpdate,
    type RefreshPayload,
} from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { BellIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { CircleIcon } from '@/components/common/icons/CircleIcon';
import { useNavigate } from 'react-router-dom';
import { requestHapticFeedback } from '@/utils/hapticFeedback';
import useInfiniteScroll from 'react-infinite-scroll-hook';
import Timeline from '@mui/lab/Timeline';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import { reminderLogger } from '@/debug/reminder';
import { loadLogger } from '@/debug/load';

import s from '@/components/home2/shared/displayType/ReminderPageList/style.module.css';
import { BellSlashIcon, BellSnoozeIcon } from '@heroicons/react/20/solid';

// Reminder Container - Container/Presentation 패턴을 따른 컴포넌트
export default function Container() {
    const { t } = useLingui();
    const navigate = useNavigate();

    const [selectionMode] = useAtom(selectionModeState);
    const toggleSelection = useSetAtom(toggleItemSelection);
    const selectedItems = useAtomValue(selectedItemsState);
    const refreshSeed = useAtomValue<RefreshPayload>(refreshSeedAfterContentUpdate);

    const {
        reminders,
        loadNextPage,
        hasMore,
        totalCount,
        reloadFromStart,
        removePageIdsOptimistically,
    } = useReminderList(100);
    const containerRef = useRef<HTMLDivElement>(null);

    // 무한 스크롤 훅 설정
    const [sentryRef] = useInfiniteScroll({
        loading: false, // WatermelonDB는 즉시 반환되므로 로딩 없음
        hasNextPage: hasMore,
        onLoadMore: () => {
            loadLogger('무한 스크롤 onLoadMore 호출됨', { hasMore });
            loadNextPage();
        },
        disabled: false,
        rootMargin: '0px 0px 400px 0px', // 하단 400px 전에 미리 로드
    });

    // 스크롤 영역이 충분하지 않을 때 자동으로 더 로드하는 로직
    useEffect(
        function autoLoadWhenNotEnoughContent() {
            // 스크롤이 없고, 더 로드할 데이터가 있을 때
            if (hasMore && reminders.length > 0 && containerRef.current) {
                const container = containerRef.current;
                const isScrollable = container.scrollHeight > container.clientHeight;
                if (!isScrollable && reminders.length < 10) {
                    // 최대 10개까지 자동 로드
                    loadLogger('스크롤 영역이 부족하여 자동 로드 실행', {
                        scrollHeight: container.scrollHeight,
                        clientHeight: container.clientHeight,
                        reminderCount: reminders.length,
                    });
                    setTimeout(() => loadNextPage(), 100); // 약간의 지연을 두고 실행
                }
            }
        },
        [hasMore, reminders.length, loadNextPage]
    );

    // 페이지 클릭 핸들러 - React Router DOM 방식으로 수정
    const handlePageClick = (pageId: string) => {
        if (selectionMode) {
            toggleSelection(pageId);
        } else {
            // reminder 페이지로 이동 (상대 경로 사용)
            navigate(`${pageId}`);
            requestHapticFeedback();
        }
    };

    // Pretty time 형태로 알람 시간 포맷팅
    const formatPrettyTime = (timestamp: number) => {
        // null, undefined, 0인 경우 모두 처리
        if (!timestamp || timestamp === 0) {
            return t`알람 미설정`;
        }

        const date = new Date(timestamp);
        const now = new Date();

        // 유효하지 않은 날짜인 경우
        if (isNaN(date.getTime())) {
            return t`알람 미설정`;
        }

        // 과거 시간인 경우 (대기 중)
        if (date <= now) {
            return t`알람 대기 중`;
        }

        // Pretty time 방식으로 상대 시간 표시
        const diffMs = date.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 60) {
            return t`${diffMinutes}분 후`;
        } else if (diffHours < 24) {
            return t`${diffHours}시간 후`;
        } else if (diffDays < 7) {
            return t`${diffDays}일 후`;
        } else {
            const diffWeeks = Math.floor(diffDays / 7);
            return t`${diffWeeks}주 후`;
        }
    };

    // 정확한 시간 포맷팅 (tooltip용)
    const formatExactTime = (timestamp: number) => {
        // null, undefined, 0인 경우 모두 처리
        if (!timestamp || timestamp === 0) {
            return '';
        }

        const date = new Date(timestamp);

        // 유효하지 않은 날짜인 경우
        if (isNaN(date.getTime())) {
            return '';
        }

        // 정확한 날짜와 시간 표시 (다국어 처리)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return t`${year}년 ${month}월 ${day}일 ${hours}:${minutes}`;
    };

    // 제목 표시 처리
    const getDisplayTitle = (title?: string, body?: string) => {
        if (title && title.trim()) {
            return title;
        }

        if (body && body.trim()) {
            // body의 첫 30자만 표시
            const cleanBody = body.replace(/[\n\r]/g, ' ').trim();
            return cleanBody.length > 30 ? cleanBody.substring(0, 30) + '...' : cleanBody;
        }

        return t`제목 없음`;
    };

    useEffect(
        function logReminderCount() {
            reminderLogger('리마인더 리스트 렌더링', {
                count: reminders.length,
                totalCount,
                hasMore,
                sentryRef: !!sentryRef,
                reminders: reminders.map((r) => ({ id: r.id, page_id: r.page_id })),
            });
        },
        [reminders.length, totalCount, hasMore, reminders]
    );

    // refreshSeed 변경 시 리스트 새로고침 (무한 스크롤 데이터 누적 유지)
    useEffect(
        function refreshListOnSeedChange() {
            if (refreshSeed.seed !== 'initial') {
                loadLogger('refreshSeed 변경으로 리마인더 리스트 새로고침', { refreshSeed });

                // 삭제 작업인 경우 낙관적 업데이트 수행
                if (refreshSeed.seed.includes('handleDelete') && selectedItems.size > 0) {
                    const pageIdsToRemove = Array.from(selectedItems);
                    reminderLogger('삭제 작업 감지 - 낙관적 업데이트 실행', { pageIdsToRemove });
                    removePageIdsOptimistically(pageIdsToRemove);
                }

                // 전체 리스트를 새로고침하여 최신 데이터 반영
                reloadFromStart();
            }
        },
        [refreshSeed, reloadFromStart, selectedItems, removePageIdsOptimistically]
    );

    return (
        <div ref={containerRef} className={`${s.container}`}>
            {reminders.length === 0 ? (
                <div className={s.emptyState}>
                    <BellSlashIcon className="w-8 h-8 mb-4" />
                    <p>{t`설정된 리마인더가 없습니다`}</p>
                </div>
            ) : (
                <>
                    <Timeline
                        position="right"
                        sx={{
                            [`& .${timelineItemClasses.root}:before`]: {
                                flex: 0,
                                padding: 0,
                            },
                            paddingRight: 0,
                        }}
                    >
                        {reminders.map((reminder, index) => {
                            const isSelected = selectedItems.has(reminder.page_id);
                            const hasValidAlarm =
                                reminder.next_alarm_time && reminder.next_alarm_time > 0;

                            return (
                                <TimelineItem key={`${reminder.id}-${reminder.page_id}-${index}`}>
                                    <TimelineSeparator>
                                        <TimelineDot
                                            className={
                                                !selectionMode && index === 0
                                                    ? s.blinkDot
                                                    : undefined
                                            }
                                            sx={{
                                                backgroundColor: selectionMode
                                                    ? 'transparent'
                                                    : 'var(--text-color)',
                                                width: selectionMode ? 'auto' : 9,
                                                height: selectionMode ? 'auto' : 9,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: 'none',
                                                border: 'none',
                                                marginTop: 1.3,
                                                cursor: selectionMode ? 'pointer' : 'default',
                                            }}
                                            onClick={
                                                selectionMode
                                                    ? (e) => {
                                                          e.stopPropagation();
                                                          handlePageClick(reminder.page_id);
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {selectionMode && (
                                                <div className="w-[0.999px] h-[0.999px]">
                                                    {isSelected ? (
                                                        <CheckCircleIcon
                                                            className="w-5 h-5 absolute left-[-5.7px] top-[6.5px]"
                                                            style={{ color: 'var(--text-color)' }}
                                                        />
                                                    ) : (
                                                        <CircleIcon
                                                            className="w-5 h-5 absolute left-[-5.7px] top-[6.5px]"
                                                            style={{ color: 'var(--text-color)' }}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </TimelineDot>
                                        {index < reminders.length - 1 && (
                                            <TimelineConnector sx={{ width: 0.05 }} />
                                        )}
                                    </TimelineSeparator>

                                    <TimelineContent>
                                        <div
                                            onClick={() => handlePageClick(reminder.page_id)}
                                            className={`pb-10 mt-[-16px] `}
                                        >
                                            <div
                                                className={`flex flex-col sm:flex-row sm:items-top gap-0 sm:gap-2 p-3 cursor-pointer rounded-lg transition-colors touch-hover-guard  ${
                                                    !isSelected
                                                        ? 'hover:bg-[var(--focus-bg-color)] active:bg-[var(--focus-bg-color)]'
                                                        : ''
                                                }`}
                                                data-selected={isSelected || undefined}
                                                style={{
                                                    backgroundColor: isSelected
                                                        ? 'var(--selection-color)'
                                                        : undefined,
                                                }}
                                            >
                                                {/* 시간 */}
                                                <div className="flex-shrink-0 opacity-50">
                                                    {hasValidAlarm ? (
                                                        <span
                                                            className="text-xs font-medium  py-1 rounded-full inline-block min-w-[60px]"
                                                            title={formatExactTime(
                                                                reminder.next_alarm_time
                                                            )}
                                                        >
                                                            {formatPrettyTime(
                                                                reminder.next_alarm_time
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-medium  py-1 rounded-full inline-block min-w-[60px]">
                                                            {t`알람 대기 중`}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 제목 + 이미지 (있을 경우: 이미지가 한 줄을 전용) */}
                                                <div className="flex-1 min-w-0 leading-snug break-all pt-[2px]">
                                                    <div className="min-w-0">
                                                        {getDisplayTitle(
                                                            reminder.page_title,
                                                            reminder.page_body
                                                        )}
                                                    </div>
                                                    {reminder.page_img_url ? (
                                                        <div className="mt-3 w-1/2">
                                                            <img
                                                                src={reminder.page_img_url}
                                                                alt="thumbnail"
                                                                className="rounded-[3px] object-contain align-bottom w-auto"
                                                                referrerPolicy="no-referrer"
                                                            />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </TimelineContent>
                                </TimelineItem>
                            );
                        })}
                    </Timeline>

                    {/* 무한 스크롤 센트리 */}
                    {hasMore && (
                        <div ref={sentryRef} className={s.scrollSentry}>
                            {/* WatermelonDB는 즉시 반환되므로 로딩 UI 불필요 */}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
