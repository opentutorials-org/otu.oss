'use client';

import { Routes, Route } from 'react-router-dom';
import dynamic from 'next/dynamic';
import Loading from '@/app/(ui)/loading';
import DynamicLoadError from '../../shared/DynamicLoadError';
import { FolderList } from './FolderList';
import { FolderDetailPageList } from './FolderDetailPageList';

// PageDetail을 동적으로 로드하여 SSR 에러 방지
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

// Folder 섹션의 모든 라우트와 컴포넌트를 하나의 청크로 관리
export default function FolderSection() {
    return (
        <Routes>
            <Route path="/" element={<FolderList />}>
                <Route path=":folderId" element={<FolderDetailPageList />}>
                    <Route path=":pageId" element={<PageDetail />} />
                </Route>
            </Route>
        </Routes>
    );
}
