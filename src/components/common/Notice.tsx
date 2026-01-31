'use client';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import React from 'react';
import { useEffect, useState } from 'react';
import s from './Notice.module.css';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export function Notice() {
    const t = useTranslations('notice');
    const tCommon = useTranslations('common');
    const NOTICE_ID = '0';
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const id = localStorage.getItem('notice_hide');
        if (id !== NOTICE_ID) {
            setOpen(true);
        }
    }, []);

    const handleClose = () => {
        setOpen(false);
    };

    const handleHide = () => {
        localStorage.setItem('notice_hide', NOTICE_ID);
        setOpen(false);
    };

    if (!open) return null;

    return (
        <Dialog open={open}>
            <DialogContent>
                <div className={s.root}>
                    <h1>{t('speed-improved')}</h1>
                    {t('browser-storage-explanation')}
                    <h1>{t('anonymous-user-launch')}</h1>
                    {t('use-without-signup')}
                    <Image
                        src="https://ucarecdn.com/07e22b8a-7c43-4458-9f71-e03fad831584/-/preview/720x720/"
                        alt={tCommon('screenshot')}
                        width="400"
                        height="400"
                    ></Image>
                    <h1>{t('ai-chat-enhanced')}</h1>
                    <p>{t('language-model-selection')}</p>
                    <p>{t('reference-selection')}</p>
                    <Image
                        src="https://ucarecdn.com/c5e6b646-7613-4c81-9bd7-b84ecd3e820f/"
                        alt={tCommon('screenshots')}
                        width="400"
                        height="400"
                    ></Image>
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleHide}>{t('hide')}</Button>
                <Button onClick={handleClose}>{t('confirm')}</Button>
            </DialogActions>
        </Dialog>
    );
}
