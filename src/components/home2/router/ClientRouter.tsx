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
                            <Route element={<CommonLayout />}>
                                <Route path="/page/*" element={<PageSection />} />
                                <Route path="/folder/*" element={<FolderSection />} />
                                {/* URL이 단일 진실 소스 (Jotai atom 대신 URL 파라미터 사용) */}
                                <Route path="/search/*" element={<SearchSection />} />
                                <Route path="/reminder/*" element={<ReminderSection />} />
                                <Route path="*" element={<Navigate to="/page" replace />} />
                            </Route>
                        </Routes>
                    </Suspense>
                </ErrorBoundary>
            </SideArticleLayout>
        </BrowserRouter>
    );
}
