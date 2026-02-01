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
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'next/navigation';

export function Withdraw() {
    const openConfirm = useSetAtom(openConfirmState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const { t } = useLingui();
    const router = useRouter();

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t`서비스 탈퇴`}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div className={s.root}>
                    <div>{t`서비스 탈퇴 시 다음 개인 정보가 영구적으로 삭제됩니다:`}</div>
                    <ul>
                        <li>{t`사용자 ID`}</li>
                        <li>{t`등록된 이메일 주소`}</li>
                        <li>{t`비밀번호`}</li>
                        <li>{t`사용자가 생성한 페이지 및 관련 모든 정보`}</li>
                    </ul>
                    <div>{t`'탈퇴 확인' 버튼을 클릭하여 추가 확인 단계를 진행하십시오.`}</div>
                    <div className={s.apply}>
                        <Button
                            variant="contained"
                            onClick={async () => {
                                openConfirm({
                                    message: t`탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
                                    onYes: async () => {
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
                            {t`탈퇴`}
                        </Button>
                    </div>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
