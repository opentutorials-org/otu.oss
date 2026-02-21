import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useLingui } from '@lingui/react/macro';
import { safeSanitize } from '@/utils/sanitize';
import s from './docDialog.module.css';

export function DocsDialog({
    title,
    body,
    open,
    onClose,
}: {
    title: string;
    body: string;
    open: boolean;
    onClose: () => void;
}) {
    const { t } = useLingui();

    return (
        <Dialog open={open} onClose={onClose} className={s.root}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent
                dangerouslySetInnerHTML={{ __html: safeSanitize(body) }}
            ></DialogContent>
            <DialogActions>
                <Button variant="contained" onClick={onClose} color="secondary">
                    {t`닫기`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
