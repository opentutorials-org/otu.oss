'use client';

import { Routes, Route } from 'react-router-dom';
import { PageList } from './PageList';
import { lazy, Suspense } from 'react';
import Loading from '@/app/(ui)/loading';

// PageDetail을 동적 로딩하여 에디터(BlockNote) 번들을 지연 로드
const PageDetail = lazy(() => import('../../shared/PageDetail'));

// Page 섹션의 모든 라우트와 컴포넌트를 하나의 청크로 관리
export default function PageSection() {
    return (
        <Routes>
            <Route path="/" element={<PageList />}>
                <Route
                    path=":pageId"
                    element={
                        <Suspense fallback={<Loading />}>
                            <PageDetail />
                        </Suspense>
                    }
                />
            </Route>
        </Routes>
    );
}
