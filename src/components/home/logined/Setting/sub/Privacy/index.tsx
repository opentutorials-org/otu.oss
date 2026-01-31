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
import { getUserLocale } from '@/i18n';
import { DIALOG_BREAKPOINT } from '@/functions/constants';

interface ConsentDialogProps {
    onClose: () => void;
    isFullScreen?: boolean;
}

export default function ConsentDialog({ onClose, isFullScreen = false }: ConsentDialogProps) {
    const theme = useTheme();
    const muiTheme = useMuiTheme();
    const fullScreen = useMediaQuery(muiTheme.breakpoints.down(DIALOG_BREAKPOINT));

    const [privacyPolicy, setPrivacyPolicy] = useState<{ title: string; body: string } | null>(
        null
    );
    useEffect(() => {
        async function fetchData() {
            const locale = await getUserLocale();
            const [{ privacyPolicy }] = await Promise.all([
                import(
                    `@/components/layout/bottom/agreement/docs/${locale}/privacy-policy_2024_6_20`
                ),
            ]);
            setPrivacyPolicy(privacyPolicy);
        }
        fetchData();
    }, []);

    if (!privacyPolicy) {
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
            <DialogTitle>{privacyPolicy.title}</DialogTitle>
            <DialogContent>
                <div className={s.root} dangerouslySetInnerHTML={{ __html: privacyPolicy.body }} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained" color="secondary">
                    닫기
                </Button>
            </DialogActions>
        </Dialog>
    );
}
