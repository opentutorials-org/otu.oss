import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import { chatMessagesState } from '@/lib/jotai';
import { useAtom, useSetAtom } from 'jotai';
import TrashIcon from '@/public/icon/Trash';
import { useTranslations } from 'next-intl';

export function CleanMessage() {
    const t = useTranslations('chat');
    const [chatMessages, setChatMessages] = useAtom(chatMessagesState);
    const cleanHandler = () => {
        setChatMessages([]);
    };
    return (
        <Tooltip title={t('delete-chat-tooltip')}>
            <span>
                <Button
                    startIcon={<TrashIcon style={{ fontSize: '1.1rem' }} />}
                    onClick={cleanHandler}
                    sx={{
                        fontSize: '0.7rem',
                        '& .MuiButton-startIcon': {
                            marginRight: 0.5,
                        },
                    }}
                    disabled={chatMessages.length === 0}
                >
                    {t('delete-chat')}
                </Button>
            </span>
        </Tooltip>
    );
}
