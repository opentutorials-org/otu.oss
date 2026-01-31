'use client';
import { useEffect } from 'react';
import debounce from 'lodash/debounce';

/* ios webkit에서 툴바를 viewport에 포함시키지 않는 문제를 해결하기 위한 클래스로 fit-height와 셋트 */
export function useCalculateViewportHeight() {
    useEffect(() => {
        const setViewportHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        // resize 이벤트에 200ms debounce 적용
        const debouncedSetViewportHeight = debounce(setViewportHeight, 200);

        // 초기 높이 설정
        setViewportHeight();

        window.addEventListener('resize', debouncedSetViewportHeight);
        return () => {
            window.removeEventListener('resize', debouncedSetViewportHeight);
        };
    }, []);
}
