import { openConfirmState } from '@/lib/jotai';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface ConfirmOptions {
    message: string;
    yesLabel: string;
}

export default function useCheckWatermelondb() {
    const openConfirm = useSetAtom(openConfirmState);
    const _t = useTranslations('notice');
    const testIndexedDBInstallation = (): Promise<boolean> => {
        return new Promise((resolve) => {
            const testDBName = 'test-indexeddb';
            const request = window.indexedDB.open(testDBName, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('test-store')) {
                    db.createObjectStore('test-store');
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                db.close();

                // DB 연결이 완전히 닫힐 때까지 대기
                setTimeout(() => {
                    const deleteRequest = window.indexedDB.deleteDatabase(testDBName);

                    deleteRequest.onsuccess = () => {
                        resolve(true);
                    };

                    deleteRequest.onerror = (event) => {
                        console.warn('IndexedDB 테스트 DB 삭제 오류:', event);
                        openConfirm({
                            message: _t('testDeletionError'),
                            yesLabel: _t('confirm'),
                        } as ConfirmOptions);
                        console.error('[IndexedDB] 테스트 DB 삭제 실패');
                        resolve(false);
                    };

                    // blocked 상태 처리 추가
                    deleteRequest.onblocked = () => {
                        console.warn(
                            'IndexedDB 테스트 DB 삭제가 다른 연결에 의해 차단됨 (정상 - 여러 탭이 열려있을 수 있음)'
                        );
                        // 테스트 목적이므로 blocked여도 정상으로 처리
                        resolve(true);
                    };
                }, 100);
            };

            request.onerror = () => {
                openConfirm({
                    message: _t('testCreationError'),
                    yesLabel: _t('confirm'),
                } as ConfirmOptions);
                console.error('[IndexedDB] 테스트 DB 생성 실패');
                resolve(false);
            };
        });
    };

    const checkIndexedDBSupport = async (): Promise<boolean> => {
        if (!window.indexedDB) {
            openConfirm({
                message: _t('unsupportedBrowser'),
                yesLabel: _t('confirm'),
            } as ConfirmOptions);
            console.error('[IndexedDB] 브라우저가 IndexedDB를 지원하지 않습니다');
            return false;
        }

        try {
            // Safari와 일부 브라우저에서는 navigator.storage.estimate가 지원되지 않으므로 체크
            if (
                typeof navigator !== 'undefined' &&
                navigator.storage &&
                typeof navigator.storage.estimate === 'function'
            ) {
                try {
                    const { quota, usage } = await navigator.storage.estimate();
                    if (quota !== undefined && quota < 5 * 1024 * 1024) {
                        openConfirm({
                            message: _t('insufficientStorage'),
                            yesLabel: _t('confirm'),
                        } as ConfirmOptions);
                        return false;
                    }
                } catch (estimateError) {
                    console.warn('Storage estimate API 호출 실패:', estimateError);
                    // 오류가 발생해도 계속 진행 (기능 저하 허용)
                }
            } else {
                console.warn('Storage estimate API가 지원되지 않는 브라우저입니다.');
                // API가 지원되지 않아도 계속 진행 (기능 저하 허용)
            }
        } catch (error) {
            openConfirm({
                message: _t('storageError'),
                yesLabel: _t('confirm'),
            } as ConfirmOptions);
            console.error('WatermelonDB check error:', error);
            return false;
        }

        const testResult = await testIndexedDBInstallation();
        if (!testResult) {
            return false;
        }
        return true;
    };

    const checkWatermelondb = async (): Promise<void> => {
        await checkIndexedDBSupport();
    };

    useEffect(() => {
        // Lighthouse 성능 측정에 영향을 주지 않도록 초기 렌더링 후 지연 실행
        const timer = setTimeout(() => {
            checkWatermelondb();
        }, 3000); // 3초 후 실행

        return () => clearTimeout(timer);
    }, []);
}
