import { chatOpenState, chatState } from '@/lib/jotai';
import { useAtom, useSetAtom } from 'jotai';
import { Btn } from '../../Btn';
import GetAppIcon from '@mui/icons-material/GetApp';
import { CreatePageAll } from '../../CreatePageAll';
import { CleanMessage } from '../../CleanMessage';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

/**
 *
 * @deprecated
 */
export function Topbar() {
    const setChatOpen = useSetAtom(chatOpenState);

    return (
        <div
            className={`absolute w-full flex justify-right items-center pl-3  z-[10000] pb-2 h-[45px] high-focus-bg-color border-text-color hover:opacity-100`}
            style={{ marginTop: 'calc(var(--native-top-inset, env(safe-area-inset-top)))' }}
        >
            <CreatePageAll />
            <CleanMessage />
            <div className="absolute right-1 ">
                <IconButton
                    sx={{ fontSize: '1.3rem' }}
                    onClick={() => {
                        setChatOpen((draft) => {
                            return false;
                        });
                    }}
                >
                    <CloseIcon fontSize="inherit" />
                </IconButton>
            </div>
        </div>
    );
}
