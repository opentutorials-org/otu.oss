import React, { lazy, Suspense } from 'react';
import { useAtomValue } from 'jotai';
import {
    confirmState,
    snackbarState,
    folderManagementDialogState,
    folderCreationDialogState,
    contentListMessageState,
} from '@/lib/jotai';
import FileUploaderLoader from './fileUploader/loader';

const Snackbar = lazy(() => import('@/components/common/Snackbar'));
const ConfirmDialog = lazy(() => import('@/components/common/ConfirmDialog'));
const FolderManagementDialog = lazy(() => import('@/components/common/FolderManagementDialog'));
const FolderCreationDialog = lazy(() => import('@/components/common/FolderCreationDialog'));
const ContentListMessage = lazy(() => import('@/components/common/ContentListMessage'));
const GlobalDragDrop = lazy(() => import('@/components/core/GlobalDragDrop'));
const Setting = lazy(() => import('./Setting'));
const Chat = lazy(() => import('../Chat').then((module) => ({ default: module.Chat })));

export default function GlobalUI() {
    // 각 컴포넌트가 표시되어야 하는지 결정하는 상태값 가져오기
    const confirm = useAtomValue(confirmState);
    const snackbar = useAtomValue(snackbarState);
    const folderDialog = useAtomValue(folderManagementDialogState);
    const folderCreationDialog = useAtomValue(folderCreationDialogState);
    const contentListMessage = useAtomValue(contentListMessageState);

    // 사용자 타입에 따라 드래그 드롭 UI 조건부 렌더링
    let dropUI = <GlobalDragDrop />;

    return (
        <Suspense fallback={null}>
            {/* 상태가 open일 때만 컴포넌트 로드 */}
            {snackbar.open && <Snackbar />}
            {/* <Analytics /> */}
            {confirm.open && <ConfirmDialog />}
            {folderDialog.open && <FolderManagementDialog />}
            {folderCreationDialog.open && <FolderCreationDialog />}
            {dropUI}

            {/* ContentList 메시지 오버레이 */}
            {contentListMessage !== '' && <ContentListMessage />}
            <FileUploaderLoader />
            <Setting />
            <Chat />
        </Suspense>
    );
}
