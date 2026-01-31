'use client';

import GlobalInput from '@/components/GlobalInput';
import ContentTypeSwitcher from '@/components/home/logined/ContentTypeSwitcher';
import { Selection } from '@/components/home/shared/Selection';
import Sort from './Sort';
import ListType from './ListType';
export default function TopControls({
    contentTypeSwitcher = true,
    selection = true,
    sort = true,
    listType = true,
}) {
    return (
        <>
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    {contentTypeSwitcher && <ContentTypeSwitcher />}
                    {selection && <Selection />}
                </div>
                <div className="flex items-center">
                    {sort && <Sort />}

                    {listType && (
                        <>
                            <span className="inline-block w-5" />
                            <ListType />
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
