// RelatedItem.tsx
import { useAtomValue } from 'jotai';
import { isModifiedState } from '@/lib/jotai';
import { readViewLogger } from '@/debug/read';
import { editorAutoSaveLogger } from '@/debug/editor';
import Link from 'next/link';
import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { isMobile } from '@/functions/isMobile';
import { useNavigate } from 'react-router-dom';

function extractFirstH1OrSentence(htmlStr: string, t: (key: string) => string) {
    // Creating a new DOM parser
    var parser = new DOMParser();
    // Parsing the HTML string
    var doc = parser.parseFromString(htmlStr, 'text/html');
    // Extracting the text within the first <h1> tag
    var h1Text = doc.querySelector('h1')?.textContent;

    if (h1Text) {
        return h1Text;
    } else {
        // Extracting all text and splitting into sentences
        var allText = doc.body.textContent || '';
        var sentences = allText.split(/[.!?]+/);
        // Return the first sentence, trim to remove any leading/trailing whitespace
        return sentences.length > 0 ? sentences[0].trim() : t('no-content-found');
    }
}

const RelatedItem = memo(function RelatedItem({ document }: { document: any }) {
    const navigate = useNavigate();
    const [active, setActive] = useState(false);
    const isModified = useAtomValue(isModifiedState);
    const t = useTranslations('read');
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(function checkDesktopEnvironment() {
        const _mobile = isMobile();
        setIsDesktop(!_mobile);
    }, []);

    // 번역 텍스트를 메모이제이션
    const translations = useMemo(
        () => ({
            relatedSimilarity: t('related-similarity', {
                similarity: (Number(document.similarity) * 100).toFixed(2),
            }),
            noContentFound: t('no-content-found'),
        }),
        [t, document.similarity]
    );

    // 제목 추출을 메모이제이션
    const displayTitle = useMemo(() => {
        return extractFirstH1OrSentence(document.content, () => translations.noContentFound);
    }, [document.content, translations.noContentFound]);

    // onClick 핸들러를 메모이제이션
    const handleClick = useCallback(async () => {
        readViewLogger('Related item clicked', { document });
        setActive(true);
        // isModified 상태 체크 후 자동 저장
        if (isModified) {
            // 브라우저 환경에서만 DOM 조작 실행
            if (typeof window !== 'undefined' && document) {
                const saveButton = window.document.querySelector(
                    '#editor-save-button .MuiButtonBase-root'
                ) as HTMLElement;
                if (saveButton) {
                    editorAutoSaveLogger(
                        'Auto-save triggered by related item click - save button found and clicked',
                        {
                            pageId: document.page_id,
                        }
                    );
                    saveButton.click();
                } else {
                    editorAutoSaveLogger(
                        'Auto-save triggered by related item click - save button NOT found',
                        {
                            pageId: document.page_id,
                        }
                    );
                }
            } else {
                editorAutoSaveLogger('Auto-save skipped - not in browser environment', {
                    pageId: document.page_id,
                });
            }
        } else {
            editorAutoSaveLogger('Related item clicked - no auto-save needed (not modified)', {
                pageId: document.page_id,
            });
        }

        await navigate(`/page/${document.page_id}`);

        if (typeof window !== 'undefined') {
            window.document.querySelector('#swipeable_modal_content')?.scrollTo(0, 0);
        }
    }, [document, isModified, isDesktop]);

    // 링크 클릭 방지 핸들러를 메모이제이션
    const handleLinkClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
    }, []);

    return (
        <li
            className={`${
                active ? 'animate-pulse' : ''
            } ml-4 opacity-60 hover:opacity-100 list-disc break-words`}
            onClick={handleClick}
        >
            <Link
                title={translations.relatedSimilarity}
                className="text-[0.9rem] hover:border-b-[1px] text-color"
                style={{ borderColor: 'var(--text-color)' }}
                href={`/home/page/${document.page_id}`}
                onClick={handleLinkClick}
            >
                {displayTitle}
            </Link>
        </li>
    );
});

export default RelatedItem;
