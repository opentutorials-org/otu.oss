'use client';

import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { currentPageContentState, currentPageState } from '@/lib/jotai';
import { editorViewLogger } from '@/debug/editor';
import { useLingui } from '@lingui/react/macro';

/**
 * 페이지 타입과 콘텐츠 상태에 따라 document.title을 자동으로 업데이트하는 컴포넌트
 *
 * 이 컴포넌트는 아무것도 렌더링하지 않지만, currentPageState나 currentPageContentState가 변경될 때마다
 * document.title을 업데이트합니다.
 */
export function DocumentTitleUpdater() {
    const currentPageContent = useAtomValue(currentPageContentState);
    const currentPage = useAtomValue(currentPageState);
    const { t } = useLingui();

    useEffect(() => {
        let pageTitle = ''; // 페이지별 타이틀

        // 1. 페이지 콘텐츠가 있는 경우 (페이지 상세보기)
        if (currentPageContent.id && currentPageContent.title) {
            pageTitle = currentPageContent.title;
        }
        // 2. 페이지 타입에 따라 타이틀 설정
        else {
            switch (currentPage.type) {
                case 'PAGE_LIST':
                    // 페이지 목록은 "OTU"만 표시 (빈 문자열)
                    pageTitle = '';
                    break;
                case 'FOLDER_LIST':
                    pageTitle = t`폴더 목록`;
                    break;
                case 'FOLDER':
                    // 폴더명이 extraData에 있으면 사용
                    if (currentPage.extraData?.folderName) {
                        pageTitle = `${currentPage.extraData.folderName}`;
                    } else {
                        pageTitle = t`폴더 목록`;
                    }
                    break;
                case 'REMINDER_LIST':
                    pageTitle = t`리마인더 목록`;
                    break;
                case 'SEARCH':
                    pageTitle = t`검색`;
                    break;
                default:
                    // 다른 타입의 경우 기본값만 사용 (접미사 없음)
                    break;
            }
        }

        // APP_TITLE_TEMPLATE 형식 적용: '%s - OTU'
        // pageTitle이 있으면 " - OTU" 접미사 추가, 없으면 기본값 "OTU"만 사용
        const newTitle = pageTitle ? `${pageTitle} - OTU` : 'OTU';

        // 기존 제목 저장
        const originalTitle = document.title;

        // 타이틀이 변경된 경우에만 업데이트
        if (originalTitle !== newTitle) {
            document.title = newTitle;

            // 디버깅용 로그
            editorViewLogger(`Document title updated: "${originalTitle}" → "${newTitle}"`, {
                pageType: currentPage.type,
                pageId: currentPage.id,
                updateTime: currentPageContent.updateTime
                    ? new Date(currentPageContent.updateTime).toISOString()
                    : null,
            });
        }
    }, [currentPageContent, currentPage, t]);

    // 아무것도 렌더링하지 않음
    return null;
}
