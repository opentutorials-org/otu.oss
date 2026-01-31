'use client';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { openConfirmState, openSnackbarState } from '@/lib/jotai';
import { useSetAtom } from 'jotai';
import s from '../style.module.css';
import { createClient } from '@/supabase/utils/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function Withdraw() {
    const openConfirm = useSetAtom(openConfirmState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const t = useTranslations('setting');
    const router = useRouter();

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t('service-withdrawal')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div className={s.root}>
                    <div>{t('withdrawal-info')}</div>
                    <ul>
                        <li>{t('user-id')}</li>
                        <li>{t('registered-email')}</li>
                        <li>{t('password')}</li>
                        <li>{t('user-generated-pages')}</li>
                    </ul>
                    <div>{t('withdrawal-process-info')}</div>
                    <div className={s.apply}>
                        <Button
                            variant="contained"
                            onClick={async () => {
                                openConfirm({
                                    message: t('confirm-withdrawal'),
                                    onYes: async () => {
                                        // const { data, error } = await supabase.auth.admin.deleteUser(
                                        //   user.id
                                        // );
                                        // @ts-ignore
                                        const resp = await fetch('/api/setting/withdraw', {
                                            method: 'POST',
                                        });
                                        const { message, status } = await resp.json();
                                        if (message) {
                                            openSnackbar({ message });
                                        }
                                        if (status === 200) {
                                            // OTUID 쿠키 삭제 (미들웨어의 로그인 풀림 감지 방지)
                                            // 탈퇴는 정상적인 로그아웃이므로 Sentry에 보고되지 않도록 쿠키를 먼저 삭제
                                            document.cookie = 'OTUID=; path=/; max-age=0';

                                            const supabase = createClient();
                                            await supabase.auth.signOut({
                                                scope: 'global',
                                            });
                                            // Race condition 방지: signOut 후 즉시 리다이렉트
                                            // (5초 대기 제거 - useCheckHomeAuth의 fetchUserId 호출로 인한 Sentry 에러 방지)
                                            router.push('/welcome');
                                        }
                                    },
                                    onNo: () => {},
                                });
                            }}
                        >
                            {t('withdrawal')}
                        </Button>
                    </div>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
