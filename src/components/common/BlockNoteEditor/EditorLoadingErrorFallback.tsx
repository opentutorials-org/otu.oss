import React, { useMemo } from 'react';
import s from './EditorLoadingErrorFallback.module.css';
import { safeSanitize } from '@/utils/sanitize';
import { useLingui } from '@lingui/react/macro';

interface EditorLoadingErrorFallbackProps {
    html: string;
}

export function EditorLoadingErrorFallback({ html }: EditorLoadingErrorFallbackProps) {
    const { t } = useLingui();

    const sanitizedHtml = useMemo(() => {
        return safeSanitize(html);
    }, [html]);

    return (
        <div className={s.container}>
            <div
                className={s.warning}
            >{t`에디터를 불러오지 못해 내용만 표시합니다. 불편을 드려 죄송합니다. 관리자에게 자동으로 문제가 보고되었습니다.`}</div>
            <div className={s.content} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        </div>
    );
}
