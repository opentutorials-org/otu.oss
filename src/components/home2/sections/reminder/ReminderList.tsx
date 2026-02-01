'use client';

import { Routes, Route, Outlet } from 'react-router-dom';
import Container from './Container';
import { useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { currentPageState } from '@/lib/jotai';
import { enhancedRenderLogger } from '@/debug/render';
import { reminderLogger } from '@/debug/reminder';
import TopControls from '@/components/home2/shared/controls/TopControls';

export function ReminderList() {
    const [currentPage, setCurrentPage] = useAtom(currentPageState);

    enhancedRenderLogger('ReminderList');

    // 컴포넌트 마운트 시 상태 설정
    useEffect(
        function initializeReminderListState() {
            setCurrentPage({
                type: 'REMINDER_LIST',
                id: null,
                path: '/home/reminder',
            });
            reminderLogger('리마인더 목록 페이지 진입');
        },
        [setCurrentPage]
    );

    return (
        <div>
            <TopControls sort={false} listType={false} />
            <div className="mt-4">
                <Container />
            </div>
            <Outlet />
        </div>
    );
}
