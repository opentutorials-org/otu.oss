'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BellIcon } from '@heroicons/react/24/outline';

export interface ReminderTickerData {
    id: string;
    page_id: string;
    next_alarm_time: number;
    page_title: string;
    page_body: string;
    page_type: 'text' | 'draw';
}

interface ReminderTickerProps {
    reminders: ReminderTickerData[];
    onReminderClick: (pageId: string) => void;
    intervalMs?: number;
}

export default function ReminderTicker({
    reminders,
    onReminderClick,
    intervalMs = 2500,
}: ReminderTickerProps) {
    const t = useTranslations('reminder');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // 다음 리마인더로 자동 전환
    useEffect(
        function autoRotateReminders() {
            if (reminders.length <= 1) return;
            if (isPaused) return;

            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % reminders.length);
            }, intervalMs);

            return () => clearInterval(interval);
        },
        [reminders.length, intervalMs, isPaused]
    );

    // 리마인더 클릭 핸들러
    const handleReminderClick = useCallback(
        (pageId: string) => {
            onReminderClick(pageId);
        },
        [onReminderClick]
    );

    // 리마인더가 없으면 공간은 유지하되 숨김 처리
    const hasReminders = reminders && reminders.length > 0;

    const currentReminder = hasReminders ? reminders[currentIndex] : null;
    const displayText = currentReminder
        ? currentReminder.page_title || currentReminder.page_body || t('untitled') || '제목 없음'
        : '';

    return (
        <div
            className="w-full mb-2 grid opacity-70"
            style={{
                gridTemplateColumns: '12px 1fr',
                minHeight: hasReminders ? 'auto' : '20px',
                visibility: hasReminders ? 'visible' : 'hidden',
            }}
            onMouseEnter={() => hasReminders && setIsPaused(true)}
            onMouseLeave={() => hasReminders && setIsPaused(false)}
            onTouchStart={() => hasReminders && setIsPaused(true)}
            onTouchEnd={() => hasReminders && setIsPaused(false)}
            onTouchCancel={() => hasReminders && setIsPaused(false)}
        >
            <style jsx global>{`
                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .reminder-slide-enter {
                    animation: slideInUp 0.3s ease-out forwards;
                }
            `}</style>
            <BellIcon className="w-[12px] h-[12px] mt-[3px] inline-block"></BellIcon>
            {hasReminders && currentReminder && (
                <div
                    key={currentReminder.id}
                    className="relative overflow-hidden reminder-slide-enter"
                >
                    <div
                        onClick={() => handleReminderClick(currentReminder.page_id)}
                        className="cursor-pointer transition-opacity hover:opacity-100 pl-1"
                    >
                        <div className="flex items-center flex-1 min-w-0">
                            <div className="flex-1 min-w-0 w-[0]">
                                <p
                                    className="text-xs font-medium truncate"
                                    style={{ color: 'var(--text-color)' }}
                                >
                                    {displayText}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
