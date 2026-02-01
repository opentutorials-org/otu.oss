'use client';

import ExportButton from '@/components/common/button/ExportButton';
import { useEffect, useState } from 'react';
import s from '../style.module.css';
import { useLingui } from '@lingui/react/macro';
import {
    FormControl,
    FormControlLabel,
    FormLabel,
    Radio,
    RadioGroup,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
} from '@mui/material';
import { getUserLocale, setUserLocale } from '@/i18n-server';
import { Locale } from '@/functions/constants';
import { getClientLocale, setClientLocale } from '@/functions/cookie';
import { useRouter } from 'next/navigation';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function Language() {
    const router = useRouter();
    const { t } = useLingui();
    const [locale, setLocale] = useState<Locale>('en');
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    const handleLanguageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newLanguage = (event.target as HTMLInputElement).value as Locale;
        setLocale(newLanguage);
        if (isOnline) {
            setUserLocale(newLanguage);
        } else {
            setClientLocale(newLanguage);
            router.refresh();
        }
    };

    useEffect(() => {
        (async () => {
            let locale: Locale;
            if (isOnline) {
                locale = (await getUserLocale()) || 'en';
            } else {
                locale = getClientLocale() || 'en';
            }
            setLocale(locale);
        })();
    }, [locale]);

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t`언어 (Language)`}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div className={`${s.root}`}>
                    <div className={s.apply}>
                        <FormControl>
                            <RadioGroup
                                aria-labelledby="demo-radio-buttons-group-label"
                                value={locale}
                                name="radio-buttons-group"
                                onChange={handleLanguageChange}
                            >
                                <FormControlLabel
                                    value="en"
                                    control={<Radio />}
                                    label={t`English`}
                                />
                                <FormControlLabel
                                    value="ko"
                                    control={<Radio />}
                                    label={t`한국어`}
                                />
                            </RadioGroup>
                        </FormControl>
                    </div>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
