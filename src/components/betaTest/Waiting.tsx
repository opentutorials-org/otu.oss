'use client';
import { useAtomValue } from 'jotai';
import React from 'react';
import { isDarkModeAtom } from '@/lib/jotai';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export function Waiting() {
    const darkMode = useAtomValue(isDarkModeAtom);
    const t = useTranslations('beta-test');

    return (
        <div className="dark:text-white flex justify-center items-center w-screen h-screen">
            <div>
                <p>{t('thanks-for-interest')}</p>
                <p>{t('preparing-welcome')}</p>
                <p>{t('will-contact-by-email')}</p>
                <p>{t('thanks-for-waiting')}</p>
                <p className="flex justify-center mt-4">
                    <Image
                        src={`/waiting/cleaning.${darkMode ? 'dark.' : ''}svg`}
                        width="100"
                        height="100"
                        alt="cleaning image"
                    ></Image>
                </p>
            </div>
        </div>
    );
}
