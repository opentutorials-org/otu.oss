import { useAtom } from 'jotai';
import { snackbarState } from '@/lib/jotai';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MuiSnackbar from '@mui/material/Snackbar';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '@/constants';
export default function Snackbar() {
    const [snackbar, setSnackbar] = useAtom(snackbarState);
    const handleClose = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    // 서버 사이드에서는 렌더링하지 않음
    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <MuiSnackbar
            open={snackbar.open}
            message={snackbar.message}
            onClose={handleClose}
            autoHideDuration={snackbar.autoHideDuration}
            anchorOrigin={{
                vertical: snackbar.vertical,
                horizontal: snackbar.horizontal,
            }}
            className="opacity-90"
            style={{
                bottom: 'calc(env(safe-area-inset-bottom) / 2)',
                zIndex: Z_INDEX.SNACKBAR,
            }}
            action={
                <>
                    {snackbar.actionBtn && (
                        <Button
                            onClick={() => {
                                snackbar.actionBtn?.onClick();
                                handleClose();
                            }}
                            className="inverted-text-color"
                            variant="contained"
                            color="primary"
                            size="small"
                        >
                            <span className="inverted-text-color">{snackbar.actionBtn.label}</span>
                        </Button>
                    )}
                    <IconButton
                        size="small"
                        aria-label="close"
                        color="inherit"
                        onClick={handleClose}
                    >
                        <CloseIcon fontSize="small" className="inverted-text-color" />
                    </IconButton>
                </>
            }
        ></MuiSnackbar>,
        document.body
    );
}
