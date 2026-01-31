import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTranslations } from 'next-intl';
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
    const t = useTranslations('docs-dialog');

    return (
        <Dialog open={open} onClose={onClose} className={s.root}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dangerouslySetInnerHTML={{ __html: body }}></DialogContent>
            <DialogActions>
                <Button variant="contained" onClick={onClose} color="secondary">
                    {t('close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
