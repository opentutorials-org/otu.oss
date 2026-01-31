'use client';

import { useLocation, useNavigate } from 'react-router-dom';
import { home2NavLogger, home2RouterLogger } from '@/debug/home2';

/**
 * React Router DOM 기반 네비게이션 훅
 *
 * 기능:
 * - 단순한 부모 경로 이동 (계층적 뒤로가기)
 * - 현재 섹션 파악
 * - 기존 navigation 함수들과 호환 가능한 인터페이스 제공
 */
export function useNavigation() {
    const location = useLocation();
    const navigate = useNavigate();

    /**
     * 부모 경로로 이동 (계층적 뒤로가기)
     * 현재 경로에서 마지막 세그먼트를 제거하여 상위 레벨로 이동
     *
     * 예시:
     * /folder/folderId/pageId → /folder/folderId
     * /page/pageId → /page
     * /folder/folderId → /folder
     * / → / (루트에서는 변화 없음)
     */
    const goBack = () => {
        const pathSegments = location.pathname.split('/').filter(Boolean);

        if (pathSegments.length > 0) {
            // 마지막 세그먼트 제거하여 부모 경로 생성
            pathSegments.pop();
            const parentPath = pathSegments.length > 0 ? '/' + pathSegments.join('/') : '/';

            home2NavLogger('goBack - 부모 경로 이동', {
                from: location.pathname,
                to: parentPath,
                pathSegments: pathSegments,
            });

            navigate(parentPath);
        } else {
            // 이미 루트(/)인 경우 변화 없음
            home2NavLogger('goBack - 루트에서 변화 없음', { from: location.pathname });
        }
    };

    /**
     * 현재 섹션을 URL에서 파악
     * basename="/home2" 고려
     * /page → 'page', /folder → 'folder' 등 (basename 제거된 상태)
     */
    const getCurrentSection = () => {
        const pathSegments = location.pathname.split('/').filter(Boolean);
        if (pathSegments.length >= 1) {
            return pathSegments[0]; // 'page', 'folder', 'reminder' 등
        }
        return 'home'; // 메인 페이지 (/) 경우
    };

    /**
     * 기존 navigation 함수들과의 호환을 위한 래퍼 함수들
     * 점진적 마이그레이션을 위해 제공
     */
    const navigateToPageEdit = (pageId: string, folderId?: string) => {
        const path = folderId ? `/folder/${folderId}/${pageId}` : `/page/${pageId}`;
        home2RouterLogger('navigateToPageEdit', { pageId, folderId, path });
        navigate(path);
    };

    const navigateToFolderDetail = (folderId: string) => {
        const path = `/folder/${folderId}`;
        home2RouterLogger('navigateToFolderDetail', { folderId, path });
        navigate(path);
    };

    const navigateToReminderPage = (pageId: string) => {
        const path = `/reminder/${pageId}`;
        home2RouterLogger('navigateToReminderPage', { pageId, path });
        navigate(path);
    };

    return {
        // 기본 RRD 훅들
        navigate,
        location,

        // 확장 네비게이션 함수들
        goBack,
        getCurrentSection,

        // 기존 함수 호환 래퍼들
        navigateToPageEdit,
        navigateToFolderDetail,
        navigateToReminderPage,
    };
}

export default useNavigation;
