import { useTheme } from '@emotion/react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    DialogActions,
    useMediaQuery,
} from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import s from '@/components/layout/bottom/agreement/docs/docDialog.module.css';
import { useEffect, useState } from 'react';
import { getUserLocale } from '@/i18n-server';
import { DIALOG_BREAKPOINT } from '@/functions/constants';

interface ConsentDialogProps {
    onClose: () => void;
    isFullScreen?: boolean;
}

export default function ConsentDialog({ onClose, isFullScreen = false }: ConsentDialogProps) {
    const theme = useTheme();
    const muiTheme = useMuiTheme();
    const fullScreen = useMediaQuery(muiTheme.breakpoints.down(DIALOG_BREAKPOINT));
    const [termsOfService, setTermsOfService] = useState<{ title: string; body: string } | null>(
        null
    );
    const [privacyPolicy, setPrivacyPolicy] = useState<{ title: string; body: string } | null>(
        null
    );
    useEffect(() => {
        async function fetchData() {
            const locale = await getUserLocale();
            const [{ termsOfService }] = await Promise.all([
                import(
                    `@/components/layout/bottom/agreement/docs/${locale}/terms-of-service_2024_6_20`
                ),
            ]);
            setTermsOfService(termsOfService);
        }
        fetchData();
    }, []);

    if (!termsOfService) {
        return null;
    }

    return (
        <Dialog
            open={true}
            fullScreen={fullScreen}
            onClose={onClose}
            PaperProps={{
                style: {
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    minWidth: '400px',
                    minHeight: '300px',
                },
            }}
        >
            <DialogTitle>{termsOfService.title}</DialogTitle>
            <DialogContent>
                <div className={s.root} dangerouslySetInnerHTML={{ __html: termsOfService.body }} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained" color="secondary">
                    닫기
                </Button>
            </DialogActions>
        </Dialog>
    );
}
