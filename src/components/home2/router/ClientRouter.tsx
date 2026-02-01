'use client';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Loading from '@/app/(ui)/loading';
import { SideArticleLayout } from '@/components/layout/MainLayout';
import CommonLayout from './Common';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// PageSection은 가장 많이 사용되는 기본 경로이므로 eager load로 변경하여 LCP 개선
import PageSection from '../sections/page/Section';
// 나머지 섹션은 lazy loading 유지
const FolderSection = lazy(() => import('../sections/folder/Section'));
const ReminderSection = lazy(() => import('../sections/reminder/Section'));
const SearchSection = lazy(() => import('../sections/search/Section'));

export default function ClientRouter() {
    return (
        <BrowserRouter basename="/home">
            <SideArticleLayout>
                <ErrorBoundary>
                    <Suspense fallback={<Loading />}>
                        <Routes>
                            {/* 홈 레이아웃 - 메인 페이지 */}

                            {/* 공통 상단 컨트롤을 가진 공통 레이아웃 */}
                            <Route element={<CommonLayout />}>
                                {/* 페이지 섹션 라우트 */}
                                <Route path="/page/*" element={<PageSection />} />

                                {/* 폴더 섹션 라우트 */}
                                <Route path="/folder/*" element={<FolderSection />} />

                                {/* 검색 섹션 라우트 (URL이 단일 진실 소스) */}
                                <Route path="/search/*" element={<SearchSection />} />

                                {/* 리마인더 섹션 라우트 */}
                                <Route path="/reminder/*" element={<ReminderSection />} />

                                {/* 일치하지 않는 모든 경로는 /page로 리디렉션 */}
                                <Route path="*" element={<Navigate to="/page" replace />} />
                            </Route>
                        </Routes>
                    </Suspense>
                </ErrorBoundary>
            </SideArticleLayout>
        </BrowserRouter>
    );
}
