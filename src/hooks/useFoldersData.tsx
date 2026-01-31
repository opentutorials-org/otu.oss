import { useEffect, useCallback, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { foldersDataState, refreshFoldersState, getFolderNameByIdState } from '@/lib/jotai';
import { getFolders } from '@/functions/folder';
import { folderLogger } from '@/debug/folder';

export function useFoldersData() {
    const [folders, setFolders] = useAtom(foldersDataState);
    const refreshTrigger = useAtomValue(refreshFoldersState);
    const [isLoading, setIsLoading] = useState(false);

    const loadFolders = useCallback(async () => {
        try {
            folderLogger('[useFoldersData] loadFolders 시작', { refreshTrigger });
            setIsLoading(true);
            const folderData = await getFolders();
            folderLogger('[useFoldersData] getFolders 결과', {
                count: folderData.length,
                ids: folderData.map((f: any) => f.id),
            });
            setFolders(folderData);
            folderLogger('[useFoldersData] setFolders 완료');
        } catch (error) {
            folderLogger('[useFoldersData] 로드 실패', { error });
            console.error('Failed to load folders:', error);
        } finally {
            setIsLoading(false);
        }
    }, [setFolders, refreshTrigger]);

    // 초기 마운트 시 즉시 폴더 데이터 로드
    useEffect(function loadFoldersOnInitialMount() {
        // 폴더 데이터가 없을 때만 로드
        if (folders.length === 0) {
            folderLogger('[useFoldersData] 초기 마운트 - 폴더 데이터 없음, 로드 시작');
            loadFolders();
        }
    }, []); // 의존성 배열을 비워서 마운트 시에만 실행

    // refreshTrigger 변경 시 폴더 데이터 새로고침
    useEffect(
        function loadFoldersOnRefresh() {
            folderLogger('[useFoldersData] refreshTrigger 변경 감지', { refreshTrigger });
            // refreshTrigger가 0이 아닐 때만 새로고침 (초기값 0 제외)
            if (refreshTrigger > 0) {
                folderLogger('[useFoldersData] refreshTrigger > 0, loadFolders 호출');
                loadFolders();
            }
        },
        [refreshTrigger, loadFolders]
    );

    return {
        folders,
        loading: isLoading,
        reload: loadFolders,
    };
}

// 폴더명을 가져오는 전용 훅
export function useGetFolderName() {
    const getFolderName = useAtomValue(getFolderNameByIdState);
    return getFolderName;
}

// 폴더 데이터 새로고침을 위한 헬퍼 훅
export function useRefreshFolders() {
    const setRefreshTrigger = useSetAtom(refreshFoldersState);

    return useCallback(() => {
        setRefreshTrigger((prev) => prev + 1);
    }, [setRefreshTrigger]);
}
