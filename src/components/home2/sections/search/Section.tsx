'use client';

import { Routes, Route } from 'react-router-dom';
import dynamic from 'next/dynamic';
import { SearchList } from './SearchList';

// PageDetail을 동적으로 로드하여 SSR 에러 방지
const PageDetail = dynamic(
    () => import('../../shared/PageDetail').catch(() => ({ default: () => null })),
    {
        ssr: false,
        loading: () => null,
    }
);

// SearchList 컴포넌트 - Page Container 재사용

// Search 섹션 라우트 정의
export default function SearchSection() {
    return (
        <Routes>
            {/* /home/search (키워드 없는 화면) */}
            <Route path="/" element={<SearchList />} />

            {/* /home/search/:keyword 및 상세 */}
            <Route path=":keyword" element={<SearchList />}>
                <Route path=":pageId" element={<PageDetail />} />
            </Route>
        </Routes>
    );
}
