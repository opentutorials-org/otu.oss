import { Q } from '@nozbe/watermelondb';
import { database } from '..';
import { createClient } from '@/supabase/utils/client';
import { syncLogger } from '@/debug/sync';
import { folderLogger } from '@/debug/folder';
import { captureException, captureMessage } from '@sentry/nextjs';

export async function get(id: string) {
    const pageCollection = database.get('page');
    try {
        const page = await pageCollection.find(id);
        return page;
    } catch (error) {
        // 페이지가 존재하지 않는 경우 null 반환
        return null;
    }
}

export async function list({
    rangeStart,
    rangeEnd,
    sortingKey,
    sortCriteria,
    searchKeyword,
    folderId,
}: {
    rangeStart: number;
    rangeEnd: number;
    sortingKey: string;
    sortCriteria: 'asc' | 'desc';
    searchKeyword: string | null;
    folderId?: string | null;
}) {
    const pageCollection = database.get('page');
    const queryParams = [];

    // folderId가 있으면 해당 폴더의 페이지만 조회
    if (folderId) {
        queryParams.push(Q.where('folder_id', folderId));
    }

    queryParams.push(Q.sortBy(sortingKey, sortCriteria === 'desc' ? Q.desc : Q.asc));
    queryParams.push(Q.skip(rangeStart));
    queryParams.push(Q.take(rangeEnd - rangeStart));
    if (searchKeyword) {
        queryParams.push(
            Q.or(
                Q.where('title', Q.like(`%${searchKeyword}%`)),
                Q.where('body', Q.like(`%${searchKeyword}%`))
            )
        );
    }
    return await pageCollection.query(...queryParams).fetch();
}

export async function create({
    id,
    title,
    body,
    is_public,
    length,
    img_url,
    created_at,
    updated_at,
    type,
    folder_id,
}: {
    id?: string;
    title: string;
    body: string;
    is_public: boolean;
    length: number;
    img_url: string | null;
    created_at?: string;
    updated_at?: string;
    type: 'text' | 'draw';
    folder_id?: string | null;
}) {
    const pageCollection = database.get('page');

    // database.write() 호출 결과를 변수에 저장
    const newPage = await database.write(async () => {
        // pageCollection.create() 호출 결과를 반환
        return await pageCollection.create((page) => {
            if (id) {
                // @ts-ignore
                page._raw.id = id;
            }
            // @ts-ignore
            page.title = title;
            // @ts-ignore
            page.body = body;
            // @ts-ignore
            page.is_public = is_public;
            // @ts-ignore
            page.length = length;
            // @ts-ignore
            page.img_url = img_url;
            // @ts-ignore
            page.folder_id = folder_id || null;
            if (created_at) {
                // @ts-ignore
                page.createdAt = created_at;
            }
            if (updated_at) {
                // @ts-ignore
                page.updatedAt = updated_at;
            }
            // @ts-ignore
            page.type = type;
        });
    });

    // 페이지 생성 후 폴더 정보는 sync를 통해 자동으로 동기화됨

    // 생성된 객체의 정보를 반환
    return {
        id: newPage._raw.id, // 생성된 행의 ID
        // @ts-ignore
        title: newPage._raw.title,
        // @ts-ignore
        body: newPage._raw.body,
        // @ts-ignore
        is_public: newPage._raw.is_public,
        // @ts-ignore
        length: newPage._raw.length,
        // @ts-ignore
        img_url: newPage._raw.img_url,
        // @ts-ignore
        folder_id: newPage._raw.folder_id,
        // @ts-ignore
        created_at: newPage._raw.created_at,
        // @ts-ignore
        updated_at: newPage._raw.updated_at,
        // @ts-ignore
        type: newPage._raw.type,
    };
}

export async function update({
    id,
    title,
    body,
    is_public,
    length,
    img_url,
    created_at,
    updated_at,
    type = 'text',
}: {
    id: string;
    title: string;
    body: string;
    is_public: boolean;
    length: number;
    img_url: string | null;
    created_at?: string;
    updated_at?: string;
    type?: 'text' | 'draw';
}) {
    const page = await get(id);
    if (!page) {
        throw new Error(`Page with id ${id} not found`);
    }

    // 업데이트 전 기존 이미지 URL과 폴더 ID 저장
    // 페이지 업데이트 시 폴더 정보는 sync를 통해 자동으로 동기화됨

    await database.write(async () => {
        await page.update((self) => {
            // @ts-ignore
            page.title = title;
            // @ts-ignore
            page.body = body;
            // @ts-ignore
            page.is_public = is_public;
            // @ts-ignore
            page.length = length;
            // @ts-ignore
            page.img_url = img_url;
            if (created_at) {
                // @ts-ignore
                page.createdAt = created_at;
            }
            if (updated_at) {
                // @ts-ignore
                page.updatedAt = updated_at;
            }
            // @ts-ignore
            page.type = type;
        });
    });

    // 이미지 URL이 변경된 경우 sync를 통해 폴더 정보가 자동으로 동기화됨
}

export async function count() {
    const pageCollection = database.get('page');
    return await pageCollection.query().fetchCount();
}

export async function getLatest() {
    const pageCollection = database.get('page');
    try {
        if ((await count()) === 0) {
            return null;
        }
        const pages = await pageCollection.query(Q.sortBy('updated_at', Q.desc)).fetch();

        return pages[0]._raw;
    } catch (error) {
        console.error('Failed to get the latest memo:', error);
        throw new Error('Failed to get the latest memo');
    }
}

export async function remove(id: string) {
    const page = await get(id);
    if (!page) return;

    // 페이지 삭제 전에 폴더 정보 저장 (sync가 폴더 정보를 자동으로 동기화함)

    await database.write(async () => {
        await page.markAsDeleted();
    });

    // 페이지 삭제 후 폴더 정보는 sync를 통해 자동으로 동기화됨
}

export async function destroyPermanently(id: string) {
    const page = await get(id);
    if (!page) return;
    await database.write(async () => {
        await page.destroyPermanently();
    });
}

export async function markAsDeletedAll() {
    const pageCollection = database.get('page');
    const pages = await pageCollection.query().fetch();
    await database.write(async () => {
        await Promise.all(pages.map((page) => page.markAsDeleted()));
    });
}

export async function destroyPermanentlyAll() {
    const pageCollection = database.get('page');
    const pages = await pageCollection.query().fetch();
    await database.write(async () => {
        await Promise.all(pages.map((page) => page.destroyPermanently()));
    });
}

export async function verifyByLast() {
    const supabase = createClient();
    try {
        const session = await supabase.auth.getSession();
        const user_id = session.data.session?.user.id;
        if (!user_id) {
            syncLogger('verifyByLast: user_id is null');
            throw new Error('user_id is null');
        }
        const { data, error } = await supabase
            .from('page')
            .select('*')
            .eq('user_id', user_id)
            .order('updated_at', { ascending: false })
            .limit(1);
        let onlineLatest = null;
        if (data && data.length === 1) {
            onlineLatest = data[0];
        }
        const offlineLatest: any = await getLatest();
        if (onlineLatest === null || offlineLatest === null) {
            const msg =
                'verifyByLast: 온라인과 오프라인 모두 null 인 케이스가 보고 되었습니다. 로직 점검이 필요합니다. 자주 보고 되면 조사하세요. ';
            syncLogger(msg, {
                onlineLatest,
                offlineLatest,
            });
            captureMessage(msg);
            return { isEqual: true, onlineLatest: null, offlineLatest: null };
        }
        // @ts-ignore
        syncLogger('verifyByLast', {
            onlineLatest,
            offlineLatest,
        });

        // @ts-ignore
        const isEqual =
            // @ts-ignore
            (onlineLatest.title?.trim() ?? '') === (offlineLatest?.title?.trim() ?? '') &&
            // @ts-ignore
            (onlineLatest.body?.trim() ?? '') === (offlineLatest?.body?.trim() ?? '');
        if (!isEqual) {
            captureMessage(
                'verifyByLast: 타이틀과 본문이 같지 않습니다. 온라인과 오프라인의 데이터가 다른 것입니다. 서버쪽 데이터를 직접 수정했고, updated_at이 null로 지정 되었을 경우 문제가 된 사례가 있었습니다.',
                {
                    // @ts-ignore
                    titleEqual:
                        (onlineLatest.title?.trim() ?? '') === (offlineLatest?.title?.trim() ?? ''),
                    // @ts-ignore
                    bodyEqual:
                        (onlineLatest.body?.trim() ?? '') === (offlineLatest?.body?.trim() ?? ''),
                }
            );
        }
        return { isEqual, onlineLatest, offlineLatest };
    } catch (error) {
        captureException(error);
        console.error(
            'verifyByLast : 마지막 페이지를 조사하는 과정에서 오류가 발생했습니다. :',
            error
        );
        throw error;
    }
}

export async function verifyByCount() {
    const supabase = createClient();
    try {
        const session = await supabase.auth.getSession();
        const user_id = session.data.session?.user.id;
        if (!user_id) {
            syncLogger('pullOnlyOnline: user_id is null');
            throw new Error('user_id is null');
        }
        const { data, count: onlineTotal } = await supabase
            .from('page')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user_id);
        const offlineTotal = await count();
        const isEqual = onlineTotal === offlineTotal;
        return { isEqual, onlineTotal, offlineTotal };
    } catch (error) {
        captureException(error);
        console.error('Failed to fetch page count:', error);
        throw error;
    }
}

export async function verifyStrong() {
    syncLogger('강력 검증이 시작 되었습니다. verifyStrong()');
    const BATCH = 100;
    const supabase = createClient();
    const session = await supabase.auth.getSession();
    const user_id = session.data.session?.user.id;
    if (!user_id) {
        syncLogger('pullOnlyOnline: user_id is null');
        throw new Error('pullOnlyOnline: user_id is null');
    }

    const { count: pageCount, error: pageCountError } = await supabase
        .from('page')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id);

    if (pageCountError) {
        console.error('Failed to fetch page count:', pageCountError);
        throw new Error('Failed to fetch page count');
    }

    const onlineIds: string[] = [];
    if (pageCount !== null && pageCount > 0) {
        const totalBatches = Math.ceil(pageCount / BATCH);
        for (let i = 0; i < totalBatches; i++) {
            const start = i * BATCH;
            const end = start + BATCH - 1;
            const { data: pageIds, error: pagesError } = await supabase
                .from('page')
                .select('id')
                .eq('user_id', user_id)
                .range(start, end);
            pageIds?.forEach((page) => {
                onlineIds.push(page.id);
            });
            if (pagesError) {
                throw new Error('검증을 위해서 페이지 목록을 가져오는데 실패했습니다');
                continue;
            }
        }
    }

    const offlineTotal = await count();
    const offlineIds: string[] = [];
    const batch = 100;
    for (let i = 0; i < offlineTotal; i += batch) {
        let pages = await list({
            rangeStart: i,
            rangeEnd: i + batch,
            sortingKey: 'created_at',
            sortCriteria: 'asc',
            searchKeyword: null,
        });
        offlineIds.push(...pages.map((page) => page.id));
        // @ts-ignore
        pages = null;
    }
    const onlineIdsSet = new Set(onlineIds);
    const offlineIdsSet = new Set(offlineIds);
    const onlyOnlineIds = onlineIds.filter((id) => !offlineIdsSet.has(id));
    const onlyOfflineIds = offlineIds.filter((id) => !onlineIdsSet.has(id));
    return {
        isEqual: onlyOnlineIds.length === 0 && onlyOfflineIds.length === 0,
        onlyOnlineIds,
        onlyOfflineIds,
        onlineTotal: onlineIds.length,
        offlineTotal: offlineIds.length,
    };
}

export async function pushOnlyOffline(onlyOfflineIds: string[]) {
    const supabase = createClient();
    const onlyOfflinePagesPromise = onlyOfflineIds.map((id) => {
        return get(id);
    });
    const onlyOfflinePagesWithNull = await Promise.all(onlyOfflinePagesPromise);
    const onlyOfflinePages = onlyOfflinePagesWithNull.filter((page) => page !== null);
    const insertData = onlyOfflinePages.map((page) => {
        return {
            id: page.id,
            // @ts-ignore
            title: page.title,
            // @ts-ignore
            body: page.body,
            // @ts-ignore
            is_public: page.is_public,
            // @ts-ignore
            length: page.length,
            // @ts-ignore
            img_url: page.img_url,
            // @ts-ignore
            created_at: page.createdAt,
            // @ts-ignore
            updated_at: page.updatedAt,
            // @ts-ignore
            type: page.type ? page.type : 'text',
        };
    });
    const result = await supabase.from('page').insert(insertData);
    return result;
}

export async function pullOnlyOnline(onlyOnlineIds: string[]) {
    const supabase = createClient();
    const session = await supabase.auth.getSession();
    const user_id = session.data.session?.user.id;
    if (!user_id) {
        syncLogger('pullOnlyOnline: user_id is null');
        return;
    }
    const result = await supabase
        .from('page')
        .select('*')
        .eq('user_id', user_id)
        .in('id', onlyOnlineIds);
    if (result.error === null && result.data.length > 0) {
        await Promise.all(
            result.data.map((page) =>
                create({
                    id: page.id,
                    title: page.title,
                    body: page.body,
                    is_public: page.is_public === null ? false : page.is_public,
                    length: page.length === null ? 0 : page.length,
                    img_url: page.img_url,
                    updated_at: page.updated_at === null ? page.created_at : page.updated_at,
                    created_at: page.created_at,
                    type: page.type,
                    // @ts-ignore
                    folder_id: page.folder_id || null, // 폴더 ID 추가
                })
            )
        );
    }
}

// 특정 폴더에 속한 페이지들을 조회하는 함수
export async function getPagesByFolderId(folderId: string) {
    const pageCollection = database.get('page');
    const pages = await pageCollection.query(Q.where('folder_id', folderId)).fetch();

    folderLogger('특정 폴더에 속한 페이지 조회', {
        folderId,
        pageCount: pages.length,
        pageIds: pages.map((p) => p.id),
    });

    return pages;
}

// 특정 폴더에 속한 페이지들의 folder_id를 null로 설정하는 함수
export async function clearFolderIdForPages(folderId: string) {
    folderLogger('폴더 삭제로 인한 페이지들의 folder_id 정리 시작', { folderId });

    const pages = await getPagesByFolderId(folderId);

    if (pages.length === 0) {
        folderLogger('정리할 페이지가 없음', { folderId });
        return;
    }

    folderLogger('페이지들의 folder_id 정리 진행', {
        folderId,
        pageCount: pages.length,
        pageIds: pages.map((p) => p.id),
    });

    await database.write(async () => {
        await Promise.all(
            pages.map((page) =>
                page.update(() => {
                    // @ts-ignore
                    page.folder_id = null;
                })
            )
        );
    });

    folderLogger('페이지들의 folder_id 정리 완료', {
        folderId,
        pageCount: pages.length,
    });
}
