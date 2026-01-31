'use client';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import s from '../style.module.css';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export function Terms() {
    const t = useTranslations('setting');

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t('terms-of-service')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div className={s.root}>
                    <ul className="mb-8 underline">
                        <li>
                            <Link href="/consent#terms-of-service">{t('terms-of-service')}</Link>
                        </li>
                        <li>
                            <Link href="/consent#privacy-policy">{t('privacy-policy')}</Link>
                        </li>
                    </ul>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
