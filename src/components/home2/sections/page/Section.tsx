'use client';

import { Routes, Route } from 'react-router-dom';
import dynamic from 'next/dynamic';
import Loading from '@/app/(ui)/loading';
import DynamicLoadError from '../../shared/DynamicLoadError';
import { PageList } from './PageList';

// PageDetail을 동적으로 로드하여 에디터(BlockNote) 번들을 지연 로드
const PageDetail = dynamic(
    () =>
        import('../../shared/PageDetail').catch((error) => {
            console.error('PageDetail 로드 실패:', error);
            return { default: DynamicLoadError };
        }),
    {
        ssr: false,
        loading: () => <Loading />,
    }
);

// Page 섹션의 모든 라우트와 컴포넌트를 하나의 청크로 관리
export default function PageSection() {
    return (
        <Routes>
            <Route path="/" element={<PageList />}>
                <Route path=":pageId" element={<PageDetail />} />
            </Route>
        </Routes>
    );
}
