import { useReminderTicker } from '@/hooks/useReminderTicker';
import { useNavigation } from '@/hooks/useNavigation';
import { useCallback } from 'react';
import { getSearchKeywordFromUrl } from '@/utils/navigation';
import { requestHapticFeedback } from '@/utils/hapticFeedback';
import GlobalUI from '@/components/core/GlobalUI';
import ReminderTicker from '@/components/common/ReminderTicker';
import GlobalInput from '@/components/GlobalInput';
import { Outlet } from 'react-router-dom';
import { useDeepLinkWebView } from '@/functions/hooks/useDeepLinkWebView';

export default function CommonLayout() {
    const { reminders } = useReminderTicker(30);
    const { navigateToPageEdit } = useNavigation();

    // 리마인더 티커 클릭 핸들러
    const handleReminderClick = useCallback(
        (pageId: string) => {
            const searchKeyword = getSearchKeywordFromUrl();
            navigateToPageEdit(pageId, searchKeyword || undefined);
            requestHapticFeedback();
        },
        [navigateToPageEdit]
    );
    useDeepLinkWebView();
    return (
        <>
            <GlobalUI />
            <div
                id="logined_main"
                className="w-full flex justify-center"
                style={
                    {
                        // height: 'calc(var(--vh, 1vh) * 99.99 - 70px - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom) / 2)',
                        // paddingBottom: 'calc(env(safe-area-inset-bottom) / 2)',
                    }
                }
            >
                <div className="max-w-[680px] w-full">
                    <div className="px-[19px] pt-[5px]">
                        <ReminderTicker
                            reminders={reminders}
                            onReminderClick={handleReminderClick}
                        />
                        <GlobalInput />
                        <Outlet />
                    </div>
                </div>
            </div>
        </>
    );
}
