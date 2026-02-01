import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { openConfirmState, openSnackbarState, refreshListState } from '@/lib/jotai';
import { remove } from '@/watermelondb/control/Page';
import { editorIndexLogger } from '@/debug/editor';
import { createClient } from '@/supabase/utils/client';
import { useLingui } from '@lingui/react/macro';
import { useCreate } from './useCreate';
import { content, contentType } from '@/types';

/**
 * 페이지 저장/삭제를 담당하는 훅
 * EditorContent의 저장/삭제 로직 추출
 */
export function usePageSave(
    content: content | null,
    folderId?: string | null,
    navigate?: (path: string) => void,
    mode?: 'create' | 'update' | null,
    setMode?: (mode: 'create' | 'update' | null) => void
) {
    const { editSubmitHandler } = useCreate();
    const openConfirm = useSetAtom(openConfirmState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const refreshList = useSetAtom(refreshListState);
    const { t } = useLingui();

    const handleDelete = useCallback(
        (_type: contentType, _id: string) => {
            openConfirm({
                message: t`정말 삭제하시겠습니까?`,
                onNo: () => {},
                yesLabel: t`삭제`,
                noLabel: t`취소`,
                onYes: async () => {
                    if (!content?.id) return;

                    const pageId = content.id;

                    try {
                        await remove(pageId);
                        openSnackbar({ message: t`삭제가 완료되었습니다.` });

                        // 외과수술적 업데이트: 삭제된 페이지 ID와 action 전달
                        refreshList({
                            source: 'components/home2/editor/hooks/usePageSave:handleDelete',
                            pageId: pageId,
                            action: 'delete',
                        });

                        // React Router 호환 네비게이션 사용
                        if (navigate) {
                            editorIndexLogger('React Router로 홈 페이지 리디렉션', { pageId });
                            setTimeout(() => {
                                navigate('/page');
                            });
                        }

                        // 페이지 삭제 시 폴더 정보도 업데이트
                        const { triggerSync } = await import('@/functions/sync');
                        triggerSync('components/home2/editor/hooks/usePageSave:handleDelete');
                        editorIndexLogger('페이지 삭제 완료', { id: pageId });

                        const supabase = createClient();
                        await supabase.from('documents').delete().eq('page_id', pageId);
                        editorIndexLogger('Supabase에서 문서 삭제 완료', {
                            page_id: pageId,
                        });
                    } catch (error) {
                        console.error('페이지 삭제 실패:', error);
                        openSnackbar({ message: t`삭제에 실패했습니다. 다시 시도해주세요.` });
                    }
                },
            });
        },
        [content?.id, openConfirm, t, openSnackbar, refreshList, navigate]
    );

    const submit = useCallback(
        async (id: string, title: string, body: string, is_public: boolean) => {
            editorIndexLogger('submit 호출', { id, title, body, is_public, folderId, mode });

            // 신규 페이지인지 확인 (mode가 'create'이면 신규 페이지)
            const isNewPage = mode === 'create';

            const result = await editSubmitHandler(title, body, is_public, id, 'text', folderId);

            // editSubmitHandler 내부에서 이미 refreshList와 triggerSync를 호출하므로 중복 호출 제거
            const action = isNewPage ? 'create' : 'update';
            editorIndexLogger('submit 완료', { result, action });

            // 신규 페이지 저장 성공 시 mode를 'update'로 변경하여 제어 버튼 활성화
            if (isNewPage && setMode) {
                setMode('update');
                editorIndexLogger('신규 페이지 저장 완료 - mode를 update로 변경');
            }
        },
        [editSubmitHandler, folderId, mode, setMode]
    );

    return {
        submit,
        handleDelete,
    };
}
