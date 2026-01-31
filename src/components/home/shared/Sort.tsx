'use client';

import { SelectBox } from '@/components/common/selectBox';
import { useAtom } from 'jotai';
import { searchMethodState } from '@/lib/jotai';
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { requestHapticFeedback } from '@/utils/hapticFeedback';
import { sortLogger } from '@/debug/sort';

export default function Sort() {
    const t = useTranslations('content-list');
    const [searchMethod, setSearchMethod] = useAtom(searchMethodState);

    sortLogger('SortControl 렌더링', {
        현재정렬기준: searchMethod.sortCriteria,
        전체상태: searchMethod,
    });

    const handleSortChange = useCallback(
        (value: string) => {
            sortLogger('정렬 기준 변경 시작', {
                이전값: searchMethod.sortCriteria,
                새값: value,
                전체상태: searchMethod,
            });

            setSearchMethod((prev) => {
                const newState = {
                    ...prev,
                    sortCriteria: value as 'asc' | 'desc',
                };
                sortLogger('정렬 상태 업데이트', { 이전상태: prev, 새상태: newState });
                return newState;
            });

            requestHapticFeedback();

            sortLogger('정렬 기준 변경 완료', { 최종값: value });
        },
        [setSearchMethod, searchMethod.sortCriteria]
    );

    return (
        <SelectBox
            // @ts-ignore
            onChange={handleSortChange}
            data={[
                { label: t('sort-by-latest'), value: 'desc' },
                { label: t('sort-by-oldest'), value: 'asc' },
            ]}
            title={t('sort')}
            // @ts-ignore
            value={searchMethod.sortCriteria}
        />
    );
}
