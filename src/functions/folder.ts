import { ulid } from 'ulid';
import * as FolderControl from '@/watermelondb/control/Folder';
import * as PageControl from '@/watermelondb/control/Page';
import { captureException } from '@sentry/nextjs';
import { triggerSync } from './sync';

// 폴더 타입 정의
export type Folder = {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    thumbnail_url?: string;
    page_count: number;
    created_at: string;
    updated_at: string;
    last_page_added_at?: string;
};

// 폴더가 실제로 조회 가능할 때까지 기다리는 함수
async function ensureFolderExists(folderId: string, maxRetries: number = 5): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const folder = await FolderControl.get(folderId);
            if (folder) {
                return true;
            }
        } catch (error) {
            // 폴더 조회 실패 시 재시도
        }

        // 재시도 전 짧은 대기
        if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    return false;
}

// 폴더 생성
export async function createFolder(name: string, description?: string): Promise<any> {
    const now = new Date().toISOString();
    const folderId = ulid();
    const newFolder = await FolderControl.create({
        id: folderId,
        name,
        description: description || '',
        page_count: 0,
        created_at: now,
        updated_at: now,
        user_id: '', // WatermelonDB에서는 user_id가 자동으로 설정됩니다
    });

    // 폴더가 실제로 조회 가능할 때까지 기다리기
    const folderExists = await ensureFolderExists(folderId);
    if (!folderExists) {
        throw new Error('폴더가 생성되었지만 조회할 수 없습니다. 잠시 후 다시 시도해주세요.');
    }

    // 폴더 생성 후 백그라운드 동기화 트리거 (즉시 반환)
    triggerSync('functions/folder/createFolder');

    return newFolder;
}

// 폴더 목록 조회
export async function getFolders(): Promise<any[]> {
    const folders = await FolderControl.list();
    const foldersData = folders.map((folder) => ({
        id: folder.id,
        // @ts-ignore
        name: folder.name,
        // @ts-ignore
        description: folder.description,
        // @ts-ignore
        thumbnail_url: folder.thumbnail_url,
        // @ts-ignore
        page_count: folder.page_count,
        // @ts-ignore
        created_at: folder.createdAt,
        // @ts-ignore
        updated_at: folder.updatedAt,
        // @ts-ignore
        last_page_added_at: folder.last_page_added_at,
        // @ts-ignore
        user_id: folder.user_id,
    }));

    return foldersData;
}

// 폴더 수정
export async function updateFolder(
    folderId: string,
    updates: { name?: string; description?: string; thumbnail_url?: string }
): Promise<any> {
    await FolderControl.update({
        id: folderId,
        ...updates,
        updated_at: new Date().toISOString(),
    });

    const updatedFolder = await FolderControl.get(folderId);
    if (!updatedFolder) {
        throw new Error(`Updated folder with id ${folderId} not found`);
    }
    const folderData = {
        id: updatedFolder.id,
        // @ts-ignore
        name: updatedFolder.name,
        // @ts-ignore
        description: updatedFolder.description,
        // @ts-ignore
        thumbnail_url: updatedFolder.thumbnail_url,
        // @ts-ignore
        page_count: updatedFolder.page_count,
        // @ts-ignore
        created_at: updatedFolder.createdAt,
        // @ts-ignore
        updated_at: updatedFolder.updatedAt,
        // @ts-ignore
        last_page_added_at: updatedFolder.last_page_added_at,
        // @ts-ignore
        user_id: updatedFolder.user_id,
    };

    // 폴더 수정 후 백그라운드 동기화 트리거 (즉시 반환)
    triggerSync('functions/folder/updateFolder');

    return folderData;
}

// 폴더 다중 삭제
export async function deleteFolders(folderIds: string[]): Promise<void> {
    const { folderLogger } = await import('@/debug/folder');
    folderLogger('[deleteFolders] 시작', { folderIds });

    if (folderIds.length === 0) {
        folderLogger('[deleteFolders] 삭제할 폴더 없음');
        return;
    }

    try {
        // 삭제 전 폴더 목록 확인
        const beforeFolders = await FolderControl.list();
        folderLogger('[deleteFolders] 삭제 전 폴더 목록', {
            count: beforeFolders.length,
            ids: beforeFolders.map((f) => f.id),
        });

        // 모든 폴더를 순차적으로 삭제 (동시 삭제 시 데이터베이스 락 방지)
        // 각 폴더 삭제 시 해당 폴더에 속한 페이지들의 folder_id도 자동으로 정리됨
        for (const folderId of folderIds) {
            folderLogger('[deleteFolders] 폴더 삭제 중', { folderId });
            await FolderControl.remove(folderId);
        }

        // 삭제 후 폴더 목록 확인
        const afterFolders = await FolderControl.list();
        folderLogger('[deleteFolders] 삭제 후 폴더 목록', {
            count: afterFolders.length,
            ids: afterFolders.map((f) => f.id),
            삭제된폴더여전히존재: folderIds.filter((id) => afterFolders.some((f) => f.id === id)),
        });

        // 폴더 다중 삭제 후 백그라운드 동기화 트리거 (즉시 반환)
        triggerSync('functions/folder/deleteFolders');
        folderLogger('[deleteFolders] 완료');
    } catch (error) {
        folderLogger('[deleteFolders] 에러', { error });
        throw error;
    }
}

// 폴더 삭제 (내부적으로 deleteFolders를 호출하여 일관된 동작 보장)
export async function deleteFolder(folderId: string): Promise<void> {
    await deleteFolders([folderId]);
}

// 폴더 정보 동기화 (페이지 수와 썸네일을 한번에 업데이트) - sync 트리거 포함
export async function syncFolderInfo(folderId: string): Promise<void> {
    try {
        const hasChanges = await syncFolderInfoSilent(folderId);

        // 변경사항이 있을 때만 동기화 트리거
        if (hasChanges) {
            triggerSync('functions/folder/syncFolderInfo');
        }
    } catch (error) {
        throw error;
    }
}

// 폴더 정보 동기화 (페이지 수와 썸네일을 한번에 업데이트) - sync 트리거 없음
export async function syncFolderInfoSilent(folderId: string): Promise<boolean> {
    try {
        const pages = await FolderControl.getPagesByFolderId(folderId);
        const pageCount = pages.length;

        // WatermelonDB Page 모델로 단언
        const pageWithImage = pages.find(
            (page) => (page as any).img_url && (page as any).img_url.trim() !== ''
        );
        const thumbnailUrl = pageWithImage ? (pageWithImage as any).img_url : '';

        const currentFolder = await FolderControl.get(folderId);
        if (!currentFolder) {
            const err = new Error(`Folder with id ${folderId} not found (syncFolderInfoSilent)`);
            captureException(err);
            throw err;
        }

        // WatermelonDB Folder 모델로 단언
        const currentPageCount = (currentFolder as any).page_count || 0;
        const currentThumbnail = (currentFolder as any).thumbnail_url || '';

        if (currentPageCount !== pageCount || currentThumbnail !== thumbnailUrl) {
            await FolderControl.update({
                id: folderId,
                page_count: pageCount,
                thumbnail_url: thumbnailUrl,
            });
            return true;
        } else {
            return false;
        }
    } catch (error) {
        captureException(error);
        throw error;
    }
}

// 여러 폴더의 정보를 일괄 동기화
export async function syncMultipleFoldersInfo(folderIds: string[]): Promise<void> {
    try {
        // 모든 폴더를 병렬로 동기화
        await Promise.all(folderIds.map((folderId) => syncFolderInfo(folderId)));
    } catch (error) {
        throw error;
    }
}

// 모든 폴더의 정보를 동기화 - sync 트리거 포함
export async function syncAllFoldersInfo(): Promise<void> {
    try {
        const folders = await FolderControl.list();
        const folderIds = folders.map((folder) => folder.id);

        if (folderIds.length > 0) {
            await syncMultipleFoldersInfo(folderIds);
        }
    } catch (error) {
        throw error;
    }
}

// 모든 폴더의 정보를 동기화 - sync 트리거 없음
export async function syncAllFoldersInfoSilent(): Promise<void> {
    try {
        const folders = await FolderControl.list();
        const folderIds = folders.map((folder) => folder.id);

        if (folderIds.length > 0) {
            // 모든 폴더를 병렬로 조용히 동기화 (sync 트리거 없음)
            await Promise.all(folderIds.map((folderId) => syncFolderInfoSilent(folderId)));
        }
    } catch (error) {
        throw error;
    }
}

// 페이지를 폴더에 추가
export async function addPageToFolder(
    pageId: string,
    folderId: string | null,
    shouldTriggerSync: boolean = true
): Promise<void> {
    // 1. 현재 페이지의 기존 폴더 ID 확인 (변경 전에 미리 조회)
    let currentFolderId: string | null = null;
    let currentPage: any = null;
    try {
        currentPage = await PageControl.get(pageId);
        // @ts-ignore
        currentFolderId = currentPage.folder_id;
    } catch (error) {
        captureException(error);
    }

    // 2. 현재 폴더 ID가 삭제된 폴더인지 확인
    if (currentFolderId) {
        try {
            const currentFolder = await FolderControl.get(currentFolderId);
            if (!currentFolder) {
                // 삭제된 폴더에 연결되어 있다면 먼저 연결 해제
                await FolderControl.setPageFolder(pageId, null);
                currentFolderId = null;
            }
        } catch (error) {
            // 폴더 조회 실패면 삭제된 것으로 간주하고 연결 해제
            await FolderControl.setPageFolder(pageId, null);
            currentFolderId = null;
        }
    }

    // 3. 새 폴더가 존재하는지 확인 (null이 아닌 경우만)
    if (folderId) {
        try {
            const targetFolder = await FolderControl.get(folderId);
            if (!targetFolder) {
                throw new Error(`폴더 ID ${folderId}가 존재하지 않습니다.`);
            }
        } catch (error) {
            throw error;
        }
    }

    // 4. 페이지의 폴더 설정
    await FolderControl.setPageFolder(pageId, folderId);

    // 5. 새 폴더에 페이지가 추가되는 경우 last_page_added_at 업데이트
    if (folderId) {
        await FolderControl.update({
            id: folderId,
            last_page_added_at: Date.now(),
            updated_at: new Date().toISOString(),
        });
    }

    // 6. 관련된 폴더들의 정보를 즉시 업데이트
    const foldersToUpdate: string[] = [];

    // 기존 폴더 (제거되는 폴더) - 삭제되지 않은 폴더만
    if (currentFolderId && currentFolderId !== folderId) {
        foldersToUpdate.push(currentFolderId);
    }

    // 새로 추가되는 폴더
    if (folderId) {
        foldersToUpdate.push(folderId);
    }

    // 7. 관련 폴더들의 정보를 즉시 동기화
    if (foldersToUpdate.length > 0) {
        try {
            await Promise.all(foldersToUpdate.map((id) => syncFolderInfoSilent(id)));
        } catch (error) {
            captureException(error);
        }
    }

    // 8. 백그라운드 서버 동기화 (선택적)
    if (shouldTriggerSync) {
        // 즉시 UI 업데이트
        if (typeof window !== 'undefined') {
            const { refreshFoldersState, refreshListState } = await import('@/lib/jotai');
            const { getDefaultStore } = await import('jotai');
            const store = getDefaultStore();

            // 즉시 폴더 데이터 새로고침
            store.set(refreshFoldersState, (prev) => prev + 1);
            // 페이지 목록도 즉시 새로고침 (외과수술적 업데이트)
            store.set(refreshListState, {
                source: 'functions/folder/addPageToFolder',
                pageId: pageId,
                action: 'update',
            });
        }

        // 백그라운드 동기화
        triggerSync('functions/folder/addPageToFolder');
    }
}

// 다중 페이지를 폴더에 추가 (최적화된 배치 처리)
export async function addPagesToFolder(pageIds: string[], folderId: string | null): Promise<void> {
    if (pageIds.length === 0) {
        return;
    }

    try {
        const affectedFolderIds = new Set<string>();

        // 1. 모든 페이지의 기존 폴더 ID 수집
        for (const pageId of pageIds) {
            try {
                const currentPage = await PageControl.get(pageId);
                // @ts-ignore
                const currentFolderId = currentPage?.folder_id;
                if (currentFolderId && currentFolderId !== folderId) {
                    // 기존 폴더가 아직 존재하는지 확인
                    try {
                        const currentFolder = await FolderControl.get(currentFolderId);
                        if (currentFolder) {
                            affectedFolderIds.add(currentFolderId);
                        }
                    } catch (error) {
                        // 폴더가 삭제된 경우 무시
                    }
                }
            } catch (error) {
                captureException(error);
            }
        }

        // 2. 대상 폴더가 존재하는지 확인 (null이 아닌 경우만)
        if (folderId) {
            try {
                const targetFolder = await FolderControl.get(folderId);
                if (!targetFolder) {
                    throw new Error(`폴더 ID ${folderId}가 존재하지 않습니다.`);
                }
                affectedFolderIds.add(folderId);
            } catch (error) {
                throw error;
            }
        }

        // 3. 모든 페이지의 폴더를 개별적으로 설정 (동기화 없이)
        for (const pageId of pageIds) {
            await addPageToFolder(pageId, folderId, false);
        }

        // 3-1. 배치로 외과수술적 업데이트 (한 번만 호출)
        if (typeof window !== 'undefined') {
            const { refreshListState } = await import('@/lib/jotai');
            const { getDefaultStore } = await import('jotai');
            const store = getDefaultStore();

            // 개별 호출 대신 배치로 한 번만 호출
            store.set(refreshListState, {
                source: 'functions/folder/addPagesToFolder',
                pageIds: pageIds,
                action: 'update',
            });
        }

        // 4. 영향받은 모든 폴더의 정보를 한 번에 동기화
        if (affectedFolderIds.size > 0) {
            try {
                await Promise.all(
                    Array.from(affectedFolderIds).map((id) => syncFolderInfoSilent(id))
                );
            } catch (error) {
                captureException(error);
            }
        }

        // 5. 마지막에 한 번만 서버 동기화 트리거
        triggerSync('functions/folder/addPagesToFolder');
    } catch (error) {
        throw error;
    }
}

// 페이지 삭제 시 폴더 정보 업데이트
export async function updateFolderAfterPageDeletion(pageId: string): Promise<void> {
    try {
        // 서버와 동기화 (sync 완료 후 자동으로 폴더 정보가 동기화됨)
        triggerSync('functions/folder/updateFolderAfterPageDeletion');
    } catch (error) {
        // 에러가 발생해도 페이지 삭제는 이미 완료된 상태이므로 에러를 throw하지 않음
    }
}

// 페이지의 폴더 정보 조회
export async function getPageFolder(pageId: string): Promise<any> {
    const page = await PageControl.get(pageId);

    if (!page) {
        return null;
    }

    // @ts-ignore
    if (!page.folder_id) {
        return null;
    }

    // @ts-ignore
    const folder = await FolderControl.get(page.folder_id);
    if (!folder) {
        return null;
    }
    const folderData = {
        id: folder.id,
        // @ts-ignore
        name: folder.name,
        // @ts-ignore
        description: folder.description,
        // @ts-ignore
        thumbnail_url: folder.thumbnail_url,
        // @ts-ignore
        page_count: folder.page_count,
        // @ts-ignore
        created_at: folder.createdAt,
        // @ts-ignore
        updated_at: folder.updatedAt,
        // @ts-ignore
        last_page_added_at: folder.last_page_added_at,
        // @ts-ignore
        user_id: folder.user_id,
    };

    return folderData;
}

// 폴더의 페이지 목록 조회
export async function getFolderPages(folderId: string) {
    const pages = await FolderControl.getPagesByFolderId(folderId);

    const pagesData = pages.map((page) => ({
        id: page.id,
        // @ts-ignore
        title: page.title,
        // @ts-ignore
        body: page.body,
        // @ts-ignore
        created_at: page.createdAt,
        // @ts-ignore
        updated_at: page.updatedAt,
        // @ts-ignore
        img_url: page.img_url,
        // @ts-ignore
        length: page.length,
        // @ts-ignore
        type: page.type,
        // @ts-ignore
        folder_id: page.folder_id,
    }));

    return pagesData;
}

// getPagesByFolderId는 getFolderPages의 별칭
export const getPagesByFolderId = getFolderPages;

// 폴더에서 다중 페이지 제거
export async function removePagesFromFolder(pageIds: string[], folderId: string): Promise<void> {
    if (pageIds.length === 0) {
        return;
    }

    try {
        // 각 페이지를 순차적으로 처리
        for (const pageId of pageIds) {
            try {
                // 직접적으로 페이지의 폴더를 null로 설정
                await FolderControl.setPageFolder(pageId, null);
            } catch (error) {
                throw error;
            }
        }

        // WatermelonDB 캐시 강제 새로고침을 위해 약간의 지연
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 폴더 정보 업데이트 (페이지 수와 썸네일)
        try {
            await syncFolderInfoSilent(folderId);
        } catch (error) {
            // 폴더 정보 동기화 실패해도 페이지 제거는 완료된 상태
        }

        // 추가 대기 후 재확인
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 외과수술적 업데이트
        if (typeof window !== 'undefined') {
            const { refreshListState } = await import('@/lib/jotai');
            const { getDefaultStore } = await import('jotai');
            const store = getDefaultStore();

            store.set(refreshListState, {
                source: 'functions/folder/removePagesFromFolder',
                pageIds: pageIds,
                action: 'update',
            });
        }

        // 백그라운드 서버 동기화
        triggerSync('functions/folder/removePagesFromFolder');
    } catch (error) {
        throw error;
    }
}
