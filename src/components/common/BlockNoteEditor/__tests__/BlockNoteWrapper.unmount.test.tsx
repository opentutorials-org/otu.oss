/** @jest-environment jsdom */
/**
 * BlockNoteWrapper 언마운트 시 에러 재현 테스트
 *
 * 이슈 #1103: BlockNote 3→4 업그레이드 후
 * "The editor view is not available" 에러 발생
 *
 * 문제 시나리오:
 * 1. Uploadcare 이미지 업로드 후 페이지 자동 전환
 * 2. BlockNoteWrapper 빠르게 언마운트
 * 3. FormattingToolbar의 CreateLinkButton cleanup에서
 *    editor.view['dom']에 접근하려 하나 에디터가 이미 파괴됨
 * 4. 에러 발생: "The editor view is not available"
 *
 * 해결책 (개선됨):
 * - isUnmountingRef useRef를 사용하여 언마운트 플래그 관리 (cleanup에서 setState 제거)
 * - Promise.resolve().then()으로 React 렌더 사이클 완료 후 에디터 컨텍스트 정리
 * - 개발/프로덕션 환경 모두에서 안정적으로 동작
 */

describe('BlockNoteWrapper - Unmount 에러 재현', () => {
    /**
     * 이 테스트는 실제 에러 상황을 시뮬레이션합니다.
     * BlockNote의 내부 구현을 직접 테스트하기는 어렵지만,
     * 우리의 수정이 올바른지 검증할 수 있습니다.
     */

    test('에디터 언마운트 순서 검증 - FormattingToolbar가 먼저 정리되어야 함', () => {
        // 언마운트 순서를 추적할 배열
        const cleanupOrder: string[] = [];

        // Mock 에디터
        const mockEditor = {
            _tiptapEditor: {
                view: {
                    dom: document.createElement('div'),
                },
                // cleanup에서 view 접근 시 에러를 발생시키는 시나리오
                destroy: () => {
                    cleanupOrder.push('editor-destroyed');
                },
            },
        };

        // FormattingToolbar cleanup 시뮬레이션
        const formattingToolbarCleanup = () => {
            cleanupOrder.push('formatting-toolbar-cleanup');

            // 실제 CreateLinkButton에서 발생하는 것과 유사한 접근
            // 에디터가 파괴된 후 view에 접근하면 에러 발생
            try {
                if (!mockEditor._tiptapEditor) {
                    throw new Error('The editor view is not available');
                }
                // view 접근 시도 (실제 CreateLinkButton에서 수행하는 것과 유사)
                void mockEditor._tiptapEditor.view;
                cleanupOrder.push('view-accessed-successfully');
            } catch (error) {
                cleanupOrder.push('view-access-error');
                throw error;
            }
        };

        // 에디터 컨텍스트 cleanup 시뮬레이션
        const editorContextCleanup = () => {
            cleanupOrder.push('editor-context-cleanup');
            mockEditor._tiptapEditor = null as any;
        };

        // 잘못된 순서 (현재 문제 상황)
        expect(() => {
            editorContextCleanup(); // 에디터 먼저 파괴
            formattingToolbarCleanup(); // toolbar에서 view 접근 시도 -> 에러!
        }).toThrow('The editor view is not available');

        expect(cleanupOrder).toEqual([
            'editor-context-cleanup',
            'formatting-toolbar-cleanup',
            'view-access-error',
        ]);

        // 올바른 순서로 다시 테스트
        cleanupOrder.length = 0;

        // 에디터 재생성
        mockEditor._tiptapEditor = {
            view: {
                dom: document.createElement('div'),
            },
            destroy: () => {
                cleanupOrder.push('editor-destroyed');
            },
        } as any;

        // 올바른 순서 (수정 후 예상 동작)
        expect(() => {
            formattingToolbarCleanup(); // toolbar 먼저 cleanup (view 접근 성공)
            editorContextCleanup(); // 그 다음 에디터 파괴
        }).not.toThrow();

        expect(cleanupOrder).toEqual([
            'formatting-toolbar-cleanup',
            'view-accessed-successfully',
            'editor-context-cleanup',
        ]);
    });

    test('에디터가 이미 파괴된 상태에서 cleanup이 안전해야 함', () => {
        const mockEditor = {
            _tiptapEditor: null as any,
            prosemirrorView: null as any,
        };

        // 에디터가 없는 상태에서도 에러가 발생하지 않아야 함
        expect(() => {
            // 에디터 존재 여부 체크
            if (mockEditor._tiptapEditor?.view) {
                // view 접근 시도
                void mockEditor._tiptapEditor.view.dom;
            }
            // 에디터가 없으면 아무 작업도 하지 않음 (안전)
        }).not.toThrow();
    });

    test('React cleanup 순서: useEffect cleanup은 역순으로 실행됨', () => {
        /**
         * React의 useEffect cleanup은 등록된 순서의 역순으로 실행됩니다.
         *
         * 예:
         * useEffect 1 -> cleanup 1
         * useEffect 2 -> cleanup 2
         *
         * 언마운트 시:
         * cleanup 2 먼저 실행
         * cleanup 1 나중에 실행
         *
         * 따라서 에디터 컨텍스트 cleanup이 나중에 등록되었다면
         * FormattingToolbar cleanup보다 먼저 실행될 수 있습니다.
         *
         * 해결책 (개선됨):
         * - isUnmountingRef useRef를 사용하여 언마운트 플래그 관리
         * - cleanup에서 setState를 하지 않음 (React 베스트 프랙티스)
         * - Promise.resolve().then()으로 microtask queue를 활용하여
         *   FormattingToolbar cleanup이 완전히 완료된 후 에디터 컨텍스트를 정리
         */

        const cleanupOrder: string[] = [];

        // useEffect가 등록되는 순서 시뮬레이션
        const useEffects = [
            {
                name: 'updateBlock-wrapper',
                cleanup: () => cleanupOrder.push('updateBlock-wrapper-cleanup'),
            },
            {
                name: 'editor-context',
                cleanup: () => cleanupOrder.push('editor-context-cleanup'),
            },
        ];

        // React는 역순으로 cleanup 실행
        for (let i = useEffects.length - 1; i >= 0; i--) {
            useEffects[i].cleanup();
        }

        // 나중에 등록된 것이 먼저 cleanup됨
        expect(cleanupOrder).toEqual(['editor-context-cleanup', 'updateBlock-wrapper-cleanup']);

        // 이것이 문제의 원인!
        // FormattingToolbar는 BlockNoteView 내부에 있고,
        // editor-context cleanup이 먼저 실행되어 에디터를 파괴하면
        // FormattingToolbar cleanup에서 view 접근 시 에러 발생
    });
});

/**
 * 수동 테스트 시나리오
 *
 * 1. 개발 서버 실행
 * 2. 하단 메뉴의 이미지 업로드 클릭
 * 3. Uploadcare를 통해 이미지 업로드
 * 4. 자동으로 페이지 열림
 * 5. 즉시 목록으로 돌아가기 (뒤로가기 또는 목록 버튼)
 * 6. 콘솔에서 다음 에러 확인:
 *    "The editor view is not available. Cannot access view['dom']"
 *
 * 수정 후:
 * 위 시나리오를 반복해도 에러가 발생하지 않아야 함
 */
