import { Q } from '@nozbe/watermelondb';
import { database } from '..';
import { folderLogger } from '@/debug/folder';
import * as PageControl from './Page';
import { clearFolderIdForPages } from './Page';

// 폴더 조회
export async function get(id: string) {
    const folderCollection = database.get('folder');
    try {
        const folder = await folderCollection.find(id);
        return folder;
    } catch (error) {
        // 폴더가 존재하지 않는 경우 null 반환
        return null;
    }
}

// 폴더 목록 조회
export async function list() {
    folderLogger('폴더 목록 조회 시작');

    const folderCollection = database.get('folder');
    const folders = await folderCollection
        .query(
            Q.where('_status', Q.notEq('deleted')),
            Q.sortBy('last_page_added_at', Q.desc),
            Q.sortBy('updated_at', Q.desc)
        )
        .fetch();

    folderLogger('폴더 목록 조회 완료', {
        totalCount: folders.length,
        folderIds: folders.map((f) => f.id),
        // @ts-ignore
        folderNames: folders.map((f) => f.name),
        // @ts-ignore
        deletedStatuses: folders.map((f) => f._raw._status),
    });

    return folders;
}

// 폴더 생성
export async function create({
    id,
    name,
    description,
    thumbnail_url,
    page_count = 0,
    created_at,
    updated_at,
    last_page_added_at,
    user_id,
}: {
    id?: string;
    name: string;
    description?: string;
    thumbnail_url?: string;
    page_count?: number;
    created_at?: string;
    updated_at?: string;
    last_page_added_at?: number;
    user_id: string;
}) {
    const folderCollection = database.get('folder');

    const newFolder = await database.write(async () => {
        return await folderCollection.create((folder) => {
            if (id) {
                // @ts-ignore
                folder._raw.id = id;
            }
            // @ts-ignore
            folder.name = name;
            // @ts-ignore
            folder.description = description || '';
            // @ts-ignore
            folder.thumbnail_url = thumbnail_url || '';
            // @ts-ignore
            folder.page_count = page_count;
            // @ts-ignore
            folder.user_id = user_id;
            if (created_at) {
                // @ts-ignore
                folder.createdAt = created_at;
            }
            if (updated_at) {
                // @ts-ignore
                folder.updatedAt = updated_at;
            }
            if (last_page_added_at) {
                // @ts-ignore
                folder.last_page_added_at = last_page_added_at;
            }
        });
    });

    return {
        id: newFolder._raw.id,
        // @ts-ignore
        name: newFolder._raw.name,
        // @ts-ignore
        description: newFolder._raw.description,
        // @ts-ignore
        thumbnail_url: newFolder._raw.thumbnail_url,
        // @ts-ignore
        page_count: newFolder._raw.page_count,
        // @ts-ignore
        created_at: newFolder._raw.created_at,
        // @ts-ignore
        updated_at: newFolder._raw.updated_at,
        // @ts-ignore
        last_page_added_at: newFolder._raw.last_page_added_at,
        // @ts-ignore
        user_id: newFolder._raw.user_id,
    };
}

// 폴더 수정
export async function update({
    id,
    name,
    description,
    thumbnail_url,
    page_count,
    updated_at,
    last_page_added_at,
}: {
    id: string;
    name?: string;
    description?: string;
    thumbnail_url?: string;
    page_count?: number;
    updated_at?: string;
    last_page_added_at?: number;
}) {
    const folder = await get(id);
    if (!folder) {
        throw new Error(`Folder with id ${id} not found`);
    }
    await database.write(async () => {
        await folder.update((self) => {
            if (name !== undefined) {
                // @ts-ignore
                folder.name = name;
            }
            if (description !== undefined) {
                // @ts-ignore
                folder.description = description;
            }
            if (thumbnail_url !== undefined) {
                // @ts-ignore
                folder.thumbnail_url = thumbnail_url;
            }
            if (page_count !== undefined) {
                // @ts-ignore
                folder.page_count = page_count;
            }
            if (updated_at) {
                // @ts-ignore
                folder.updatedAt = updated_at;
            }
            if (last_page_added_at) {
                // @ts-ignore
                folder.last_page_added_at = last_page_added_at;
            }
        });
    });
}

// 폴더 삭제
export async function remove(id: string) {
    folderLogger('폴더 삭제 시작', { folderId: id });

    const folder = await get(id);
    if (!folder) {
        folderLogger('폴더를 찾을 수 없음 - 삭제 중단', { folderId: id });
        return;
    }

    folderLogger('폴더 발견 - 삭제 진행', {
        folderId: id,
        // @ts-ignore
        folderName: folder.name,
    });

    // 폴더 삭제 전에 해당 폴더에 속한 페이지들의 folder_id를 null로 설정
    try {
        await clearFolderIdForPages(id);
        folderLogger('폴더에 속한 페이지들의 folder_id 정리 완료', { folderId: id });
    } catch (error) {
        folderLogger('폴더에 속한 페이지들의 folder_id 정리 실패', { folderId: id, error });
        // 에러가 발생해도 폴더 삭제는 진행 (페이지들의 folder_id 정리는 선택사항)
    }

    await database.write(async () => {
        await folder.markAsDeleted();
        folderLogger('폴더 markAsDeleted 완료', { folderId: id });
    });

    // 삭제 후 상태 확인
    const deletedFolder = await get(id);
    folderLogger('삭제 후 상태 확인', {
        folderId: id,
        stillExists: !!deletedFolder,
        // @ts-ignore
        isDeleted: deletedFolder?._raw?._status === 'deleted',
    });
}

// 폴더 완전 삭제
export async function destroyPermanently(id: string) {
    const folder = await get(id);
    if (!folder) return;
    await database.write(async () => {
        await folder.destroyPermanently();
    });
}

// 폴더별 페이지 조회
export async function getPagesByFolderId(folderId: string) {
    const pageCollection = database.get('page');
    return await pageCollection
        .query(Q.where('folder_id', folderId), Q.sortBy('updated_at', Q.desc))
        .fetch();
}

// 페이지의 폴더 설정
export async function setPageFolder(pageId: string, folderId: string | null) {
    const page = await PageControl.get(pageId);
    if (!page) {
        throw new Error(`Page with id ${pageId} not found`);
    }

    await database.write(async () => {
        await page.update((self) => {
            // @ts-ignore
            self.folder_id = folderId;
        });
    });
}

// 폴더 내 페이지 수 계산
export async function countPagesInFolder(folderId: string) {
    const pageCollection = database.get('page');
    return await pageCollection.query(Q.where('folder_id', folderId)).fetchCount();
}

// 폴더의 페이지 수 업데이트
export async function updateFolderPageCount(folderId: string) {
    const pageCount = await countPagesInFolder(folderId);
    await update({
        id: folderId,
        page_count: pageCount,
        updated_at: new Date().toISOString(),
    });
}

// 디버깅용: 삭제된 폴더들도 포함한 전체 목록 조회
export async function listAllIncludingDeleted() {
    folderLogger('삭제된 폴더 포함 전체 목록 조회 시작');

    const folderCollection = database.get('folder');
    // includeDeleted 옵션을 사용하여 삭제된 항목도 포함
    const allFolders = await folderCollection.query().fetch();

    folderLogger('삭제된 폴더 포함 전체 목록 조회 완료', {
        totalCount: allFolders.length,
        folders: allFolders.map((f) => ({
            id: f.id,
            // @ts-ignore
            name: f.name,
            // @ts-ignore
            status: f._raw._status || 'active',
        })),
    });

    return allFolders;
}

// 디버깅용: 특정 폴더의 상세 상태 확인
export async function debugFolderStatus(folderId: string) {
    folderLogger('폴더 상태 디버깅 시작', { folderId });

    try {
        const folderCollection = database.get('folder');
        // 삭제된 것도 포함하여 직접 찾기
        const allFolders = await folderCollection.query().fetch();
        const targetFolder = allFolders.find((f) => f.id === folderId);

        if (targetFolder) {
            folderLogger('폴더 상태 정보', {
                folderId,
                // @ts-ignore
                name: targetFolder.name,
                // @ts-ignore
                status: targetFolder._raw._status || 'active',
                // @ts-ignore
                rawData: targetFolder._raw,
            });
        } else {
            folderLogger('폴더를 찾을 수 없음', { folderId });
        }

        // 일반 get 함수로도 확인
        const getResult = await get(folderId);
        folderLogger('get 함수 결과', {
            folderId,
            found: !!getResult,
            // @ts-ignore
            name: getResult?.name,
        });
    } catch (error) {
        folderLogger('폴더 상태 디버깅 중 오류', { folderId, error });
    }
}
