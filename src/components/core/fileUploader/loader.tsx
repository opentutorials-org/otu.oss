'use client';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { fileUploaderOpenState } from '@/lib/jotai';

// 실제 FileUploader 컴포넌트를 lazy로 import
const FileUploader = lazy(() => import('./index'));

// 로딩 컴포넌트는 이제 공통 컴포넌트로 분리됨

/**
 * FileUploaderLoader 컴포넌트
 * fileUploaderOpenState atom을 구독하여 파일 업로더가 필요할 때만
 * 실제 FileUploader 컴포넌트를 로드하는 중간 래퍼 컴포넌트
 */
export default function FileUploaderLoader() {
    const fileUploaderOpen = useAtomValue(fileUploaderOpenState);
    const [shouldRender, setShouldRender] = useState(false);
    // const isAnonymous = getUserType() === 'anonymous';
    const isAnonymous = false;

    // fileUploaderOpen 상태가 변경될 때마다 shouldRender 상태 업데이트
    useEffect(() => {
        let isMounted = true;
        if (fileUploaderOpen && !isAnonymous && isMounted) {
            setShouldRender(true);
        }

        return () => {
            isMounted = false;
        };
    }, [fileUploaderOpen, isAnonymous]);

    // 익명 사용자이면 렌더링하지 않음
    if (isAnonymous) {
        return null;
    }

    // blocknote 에디터 내에서 dynamic 로더를 사용하면 실행이 안되는 경우가 있어서 일단 항상 로드하게 처리 함
    // if (shouldRender) {
    if (true) {
        return (
            <Suspense>
                <FileUploader />
            </Suspense>
        );
    }

    return null;
}
