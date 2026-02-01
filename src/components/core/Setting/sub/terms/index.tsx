'use client';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import s from '../style.module.css';
import { useLingui } from '@lingui/react/macro';
import Link from 'next/link';

export function Terms() {
    const { t } = useLingui();

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t`서비스 이용 약관`}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div className={s.root}>
                    <ul className="mb-8 underline">
                        <li>
                            <Link href="/consent#terms-of-service">{t`서비스 이용 약관`}</Link>
                        </li>
                        <li>
                            <Link href="/consent#privacy-policy">{t`개인정보 처리방침`}</Link>
                        </li>
                    </ul>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
