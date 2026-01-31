'use client';

import { useAIStatus } from '@/functions/hooks/useAIStatus';
import { useTranslations } from 'next-intl';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/**
 * AI 기능이 비활성화되어 있을 때 표시하는 배너 컴포넌트
 */
export function AIDisabledBanner() {
    const { status, isLoading } = useAIStatus();
    const t = useTranslations('chat');

    // 로딩 중이거나 AI가 활성화된 경우 배너를 표시하지 않음
    if (isLoading || status.canUseChat) {
        return null;
    }

    return (
        <div className="mx-4 mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
            <InfoOutlinedIcon className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium">{t('ai-disabled-title')}</p>
                <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                    {t('ai-disabled-message')}
                </p>
            </div>
        </div>
    );
}
