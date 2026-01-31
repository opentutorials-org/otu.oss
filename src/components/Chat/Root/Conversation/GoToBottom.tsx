import { chatScrollToBottomState } from '@/lib/jotai';
import { useSetAtom } from 'jotai';
import { Btn } from '../../Btn';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
export function GoToBottom({ open }: { open: boolean }) {
    const setChatScrollToBottom = useSetAtom(chatScrollToBottomState);
    return (
        <div className={`absolute z-10 top-[0] ml-3 opacity-50 ${open ? '' : 'hidden'}`}>
            <Btn
                src={<ArrowCircleDownIcon sx={{ fontSize: '17px' }} />}
                alt="go to bottom"
                onClick={() => {
                    setChatScrollToBottom(Math.random());
                }}
            ></Btn>
        </div>
    );
}
