import React, { useMemo } from 'react';
import s from './EditorLoadingErrorFallback.module.css';
import DOMPurify from 'dompurify';
import { useTranslations } from 'next-intl';

interface EditorLoadingErrorFallbackProps {
    html: string;
}

export function EditorLoadingErrorFallback({ html }: EditorLoadingErrorFallbackProps) {
    const t = useTranslations('editor');

    const sanitizedHtml = useMemo(() => {
        return DOMPurify.sanitize(html);
    }, [html]);

    return (
        <div className={s.container}>
            <div className={s.warning}>{t('loading_error_fallback_message')}</div>
            <div className={s.content} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        </div>
    );
}
