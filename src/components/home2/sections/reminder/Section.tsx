'use client';

import { Routes, Route } from 'react-router-dom';
import dynamic from 'next/dynamic';
import { ReminderList } from './ReminderList';

// PageDetail을 동적으로 로드하여 SSR 에러 방지
const PageDetail = dynamic(() => import('../../shared/PageDetail'), {
    ssr: false,
});

// Reminder 섹션의 모든 라우트와 컴포넌트를 하나의 청크로 관리
export default function ReminderSection() {
    return (
        <Routes>
            <Route path="/" element={<ReminderList />}>
                <Route path=":pageId" element={<PageDetail />} />
            </Route>
        </Routes>
    );
}
