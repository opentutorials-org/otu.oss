'use client';
import DebugInfo from '@/components/home/logined/Setting/sub/DebugInfo';
import Export from './sub/Export';
import { Withdraw } from './sub/Withdraw';
import { settingState } from '@/lib/jotai';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import Language from './sub/Language';
import CustomPrompt from './sub/CustomPrompt';
import { Terms } from './sub/terms';
import { DIALOG_BREAKPOINT } from '@/functions/constants';
import Profile from './sub/Profile';

// View 컴포넌트는 설정 다이얼로그를 렌더링합니다.
export default function View() {
    const [setting, setSetting] = useAtom(settingState);
    const { t } = useLingui();
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down(DIALOG_BREAKPOINT));

    // Escape 키를 눌렀을 때 다이얼로그를 닫습니다.
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (setting.open) {
                if (event.key === 'Escape') {
                    setSetting({ open: false });
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [setting.open]);

    return (
        <Dialog open={setting.open} fullScreen={fullScreen}>
            <DialogContent>
                <div className="mt-3">
                    <Language />
                    <Terms />
                    <Profile />
                    <Export />
                    <Withdraw />
                    <CustomPrompt />
                    <DebugInfo />
                </div>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={() => {
                        setSetting({ open: false });
                    }}
                    variant="contained"
                    color="secondary"
                >
                    {t`닫기`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
