import { useCallback, useEffect, useRef } from 'react';
import { debounce } from 'lodash';
import { editorViewLogger } from '@/debug/editor';

export function useAutoSave({
    isModified,
    submitHandler,
    autoSaveInterval = 3000,
}: {
    isModified: boolean;
    submitHandler: () => Promise<void>;
    autoSaveInterval?: number;
}) {
    const lastAutoSaveTimeRef = useRef<number>(0);
    const isAutoSavingRef = useRef<boolean>(false);
    const retryCountRef = useRef<number>(0);
    const submitHandlerRef = useRef(submitHandler);
    const isModifiedRef = useRef(isModified);
    const debouncedAutoSaveRef = useRef<any>(null);
    const MAX_RETRY_COUNT = 3;

    // submitHandler ref 업데이트
    useEffect(() => {
        submitHandlerRef.current = submitHandler;
    }, [submitHandler]);

    // isModified ref 업데이트
    useEffect(() => {
        isModifiedRef.current = isModified;
    }, [isModified]);

    // debounce 함수를 ref로 관리하여 안정적으로 유지
    if (!debouncedAutoSaveRef.current) {
        debouncedAutoSaveRef.current = debounce(
            async () => {
                // debounce 실행 시점에서 최신 isModified 상태를 확인
                if (isAutoSavingRef.current || !isModifiedRef.current) {
                    editorViewLogger('자동저장 스킵 - 저장 중이거나 수정사항 없음');
                    return;
                }

                try {
                    isAutoSavingRef.current = true;
                    editorViewLogger('자동저장 시작 (debounce 완료 후)');

                    await submitHandlerRef.current();

                    // 성공 시 재시도 카운트 초기화
                    retryCountRef.current = 0;
                    lastAutoSaveTimeRef.current = Date.now();

                    editorViewLogger('자동저장 완료');
                } catch (error) {
                    retryCountRef.current++;

                    if (retryCountRef.current < MAX_RETRY_COUNT) {
                        // 재시도
                        setTimeout(() => debouncedAutoSaveRef.current(), 5000);
                        editorViewLogger(
                            `자동저장 실패, ${retryCountRef.current}/${MAX_RETRY_COUNT} 재시도`
                        );
                    } else {
                        editorViewLogger('자동저장 최대 재시도 횟수 초과');
                    }
                } finally {
                    isAutoSavingRef.current = false;
                }
            },
            autoSaveInterval,
            { leading: false, trailing: true }
        );
    }

    // 외부에서 호출할 수 있는 트리거 함수
    const triggerAutoSave = useCallback(() => {
        if (!isAutoSavingRef.current) {
            editorViewLogger('자동저장 debounce 트리거 - 연속 편집 중에는 저장되지 않음');
            debouncedAutoSaveRef.current();
        }
    }, []);

    // cleanup
    useEffect(() => {
        return () => {
            if (debouncedAutoSaveRef.current) {
                debouncedAutoSaveRef.current.cancel();
            }
        };
    }, []);

    return {
        lastAutoSaveTime: lastAutoSaveTimeRef.current,
        isAutoSaving: isAutoSavingRef.current,
        triggerAutoSave, // 외부에서 호출할 트리거 함수 제공
    };
}
