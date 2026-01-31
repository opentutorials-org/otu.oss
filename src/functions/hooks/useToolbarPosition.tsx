'use client';
import { useEffect, useRef, useState } from 'react';
import { useDebounce } from './useDebounce';

/**
 * 툴바의 위치를 관리하는 커스텀 훅입니다.
 *
 * @param {string} toolbarWrapId - 툴바를 감싸는 요소의 ID입니다.
 * @param {string} toolbarId - 툴바 요소의 ID입니다.
 * @param {string} topbarId - 탑바 요소의 ID입니다.
 * @param {string} editorId - 에디터 요소의 ID입니다.
 * @returns {Object} 툴바, 탑바, 에디터 요소의 참조와 툴바의 위치를 설정하는 함수를 반환합니다.
 * @returns {React.RefObject<HTMLElement>} toolbarRef - 툴바 요소의 참조입니다.
 * @returns {React.RefObject<HTMLElement>} topbarRef - 탑바 요소의 참조입니다.
 * @returns {React.RefObject<HTMLElement>} editorRef - 에디터 요소의 참조입니다.
 *
 * 참고 : https://www.codemzy.com/blog/sticky-fixed-header-ios-keyboard-fix
 */
function useToolbarPosition(
    toolbarWrapId: string,
    toolbarId: string,
    topbarId: string, // 새로 추가된 인자
    editorId: string
) {
    if (typeof window === 'undefined') {
        return;
    }
    if ('virtualKeyboard' in navigator) {
        return {
            toolbarRef: useRef(null),
            topbarRef: useRef(null),
            editorRef: useRef(null),
        };
    }

    const [fixPosition, setFixPosition] = useState<number>(0);
    const toolbarWrapRef = useRef<HTMLElement | null>(null);
    const toolbarRef = useRef<HTMLElement | null>(null);
    const topbarRef = useRef<HTMLElement | null>(null); // topbar 참조를 위한 ref 추가
    const editorRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const toolbarWrapElement = document.querySelector<HTMLElement>(toolbarWrapId);
            const toolbarElement = document.querySelector<HTMLElement>(toolbarId);
            const topbarElement = document.querySelector<HTMLElement>(topbarId); // topbar 요소 선택
            const editorElement = document.querySelector<HTMLElement>(editorId);

            if (toolbarWrapElement && toolbarElement && topbarElement && editorElement) {
                toolbarWrapElement.style.height = '40px';

                topbarElement.style.position = toolbarElement.style.position = 'absolute';
                toolbarElement.style.backgroundColor = topbarElement.style.backgroundColor =
                    'white';
                toolbarElement.style.width = '100%'; // topbar의 너비 설정
                topbarElement.style.display = 'flex';
                topbarElement.style.justifyContent = 'end';
                topbarElement.style.zIndex = '100';

                toolbarWrapRef.current = toolbarWrapElement;
                toolbarRef.current = toolbarElement;
                topbarRef.current = topbarElement; // topbar 참조 저장
                editorRef.current = editorElement;
                observer.disconnect();
            }
        });

        observer.observe(document, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [toolbarWrapId, toolbarId, topbarId, editorId]); // 의존성 배열에 topbarId 추가

    const setMargin = () => {
        if (toolbarWrapRef.current && toolbarRef.current && topbarRef.current) {
            const newPosition = toolbarWrapRef.current.getBoundingClientRect().top;
            if (newPosition < -1) {
                let fixPos = Math.abs(newPosition);
                if (window.innerHeight + window.pageYOffset >= document.body.offsetHeight) {
                    fixPos -= 2;
                }
                setFixPosition(fixPos);
                topbarRef.current.style.marginTop =
                    toolbarRef.current.style.marginTop = `${fixPos}px`;
                topbarRef.current.style.transition = toolbarRef.current.style.transition =
                    'all 500ms cubic-bezier(0.4, 0, 0.2, 1)';
            }
        }
    };

    const showToolbar = () => {
        if (fixPosition > 0 && toolbarRef.current && topbarRef.current) {
            setFixPosition(0);
            topbarRef.current.style.marginTop = toolbarRef.current.style.marginTop = '0px';
            topbarRef.current.style.transition = toolbarRef.current.style.transition = '';
        }
        debounceMargin();
    };

    const debounceMargin = useDebounce(setMargin, 150);

    useEffect(() => {
        window.addEventListener('scroll', showToolbar);
        editorRef.current?.addEventListener('blur', showToolbar);
        topbarRef.current?.addEventListener('blur', showToolbar); // topbar에도 blur 이벤트 리스너 추가

        return () => {
            window.removeEventListener('scroll', showToolbar);
            editorRef.current?.removeEventListener('blur', showToolbar);
            topbarRef.current?.removeEventListener('blur', showToolbar); // topbar의 blur 이벤트 리스너 제거
        };
    }, [fixPosition, showToolbar]);

    return { toolbarRef, topbarRef, editorRef }; // topbarRef도 반환
}

export default useToolbarPosition;
