'use client';
import Button from '@mui/material/Button';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { currentPageState, openConfirmState, settingState } from '@/lib/jotai';
import { useAtom, useSetAtom } from 'jotai';
import s from '../style.module.css';
import { clearOnlyWatermelonDB, clearStorage } from '@/functions/clearStorage';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function DeleteAll() {
    const t = useTranslations('setting.delete-all');
    const openConfirm = useSetAtom(openConfirmState);
    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const setSetting = useSetAtom(settingState);
    const router = useRouter();

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t('title')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div>
                    <h1>{t('title')}</h1>
                </div>
                <div>{t('description')}</div>
                <div>{t('instruction')}</div>
                <div className={s.apply}>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            openConfirm({
                                message: t('confirm-message'),
                                onYes: async () => {
                                    await clearStorage(t('clear-storage-message'));
                                    setSetting({ open: false });
                                    setCurrentPage({ type: 'HOME', id: null, path: '/' });
                                    router.push('/welcome');
                                },
                                yesLabel: t('confirm'),
                                onNo: () => {},
                            });
                        }}
                    >
                        {t('delete')}
                    </Button>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
