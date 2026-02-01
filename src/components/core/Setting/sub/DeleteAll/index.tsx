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
import { useLingui } from '@lingui/react/macro';

export function DeleteAll() {
    const { t } = useLingui();
    const openConfirm = useSetAtom(openConfirmState);
    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const setSetting = useSetAtom(settingState);
    const router = useRouter();

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t`데이터 삭제`}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div>
                    <h1>{t`데이터 삭제`}</h1>
                </div>
                <div>{t`모든 데이터를 삭제 합니다.`}</div>
                <div>{t`'삭제' 버튼을 클릭하면, 추가적인 확인 절차를 거쳐 삭제가 진행됩니다.`}</div>
                <div className={s.apply}>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            openConfirm({
                                message: t`정말 삭제하시겠습니까? 복원이 불가능합니다.`,
                                onYes: async () => {
                                    await clearStorage(t`익명 사용자 모드에서 모든 데이터 삭제`);
                                    setSetting({ open: false });
                                    setCurrentPage({ type: 'HOME', id: null, path: '/' });
                                    router.push('/welcome');
                                },
                                yesLabel: t`확인`,
                                onNo: () => {},
                            });
                        }}
                    >
                        {t`삭제`}
                    </Button>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
