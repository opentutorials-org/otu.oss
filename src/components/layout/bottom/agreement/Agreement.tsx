'use client';
import { useTranslations } from 'next-intl';

export function Agreement() {
    const t = useTranslations('agreement-form');

    return (
        <div className="absolute z-1000 text-white top-[-25px] text-[8pt]">
            {t('implicit-consent-notice')}
        </div>
    );
}
