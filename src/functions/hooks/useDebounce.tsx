'use client';
import { useCallback, useRef } from 'react';

// useDebounce 훅 타입 개선
export function useDebounce(func: Function, delay: number) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const debouncedFunction = useCallback(
        (...args: any[]) => {
            clearTimeout(timeoutRef.current!);
            timeoutRef.current = setTimeout(() => {
                func(...args);
            }, delay);
        },
        [func, delay]
    );

    return debouncedFunction;
}
