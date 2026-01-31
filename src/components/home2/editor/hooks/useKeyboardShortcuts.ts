import { useEffect, useRef } from 'react';
import { editorViewLogger } from '@/debug/editor';
import { detectOS } from '@/functions/detectos';

/**
 * 키보드 단축키와 가상 키보드 관련 로직을 처리하는 훅
 */
export function useKeyboardShortcuts({
    isOpen,
    submitHandler,
    setIsModified,
}: {
    isOpen: boolean;
    submitHandler: () => void;
    setIsModified: (isModified: boolean) => void;
}) {
    // 상태가 변경될 때 참조를 업데이트하기 위한 ref
    const submitHandlerRef = useRef(submitHandler);

    // submitHandler ref 업데이트
    useEffect(() => {
        submitHandlerRef.current = submitHandler;
    }, [submitHandler]);

    // 저장 단축키 핸들러 (Cmd/Ctrl + S)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 's') {
                event.preventDefault();
                editorViewLogger('저장 단축키(Cmd/Ctrl + S) 감지 및 처리 시작');
                submitHandlerRef.current();
                editorViewLogger('저장 단축키(Cmd/Ctrl + S) 감지 및 처리 완료');
            }
        };

        if (isOpen) {
            // 더 나은 캡처를 위해 window 대신 document에 이벤트 리스너 추가
            document.addEventListener('keydown', handleKeyDown, { capture: true });
            editorViewLogger('저장 단축키 리스너 추가');
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown, { capture: true });
            editorViewLogger('저장 단축키 리스너 제거');
        };
    }, [isOpen]);

    // 가상 키보드 설정
    useEffect(() => {
        if (typeof window === 'undefined' || !('virtualKeyboard' in navigator)) {
            return;
        }

        if (isOpen) {
            // @ts-ignore
            // 가상 키보드 활성화시 화면 전체를 밀어내도록 변경
            // window.navigator.virtualKeyboard.overlaysContent = true;
            editorViewLogger('가상 키보드 활성화 - 오버레이 설정');
        } else {
            // @ts-ignore
            // window.navigator.virtualKeyboard.overlaysContent = false;
            setIsModified(false);
            editorViewLogger('가상 키보드 비활성화 - 오버레이 해제 및 수정 상태 초기화');
        }

        return () => {
            // @ts-ignore
            window.navigator.virtualKeyboard.overlaysContent = false;
            setIsModified(false);
            editorViewLogger('가상 키보드 비활성화 - 오버레이 해제 및 수정 상태 초기화');
        };
    }, [isOpen, setIsModified]);

    // 현재 OS 기반 저장 단축키 텍스트 반환
    const getSaveShortcutText = () => {
        return detectOS() === 'MacOS' ? 'Cmd + S' : 'Ctrl + S';
    };

    return {
        saveShortcutText: getSaveShortcutText(),
    };
}
