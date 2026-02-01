'use client';
import { useAtom } from 'jotai';
import { settingState } from '@/lib/jotai';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// View 컴포넌트를 동적 로딩하여 초기 번들 크기 감소
const View = dynamic(() => import('./view'), {
    ssr: false,
});

export default function Setting() {
    const [setting] = useAtom(settingState);

    if (!setting.open) return null;

    return (
        <Suspense fallback={null}>
            <View />
        </Suspense>
    );
}
