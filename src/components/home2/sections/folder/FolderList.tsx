'use client';

import { Outlet } from 'react-router-dom';
import Container from './Container';
import { enhancedRenderLogger } from '@/debug/render';
import TopControls from '@/components/home/shared/TopControls';

// FolderList 컴포넌트 - Container/Presentation 패턴 사용
export function FolderList() {
    enhancedRenderLogger('FolderList');

    return (
        <div>
            <TopControls sort={false} listType={false} />
            {/* 폴더 그리드 */}
            <div className="mt-4">
                <Container />
            </div>
            <Outlet />
        </div>
    );
}
