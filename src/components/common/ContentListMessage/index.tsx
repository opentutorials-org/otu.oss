import { useAtom } from 'jotai';
import { contentListMessageState } from '@/lib/jotai';
import DOMPurify from 'dompurify';
import { useTheme } from '@mui/material/styles';

export default function ContentListMessage() {
    const [contentListMessage, setContentListMessage] = useAtom(contentListMessageState);
    const theme = useTheme();

    if (contentListMessage === '') {
        return null;
    }

    const handleClose = () => {
        setContentListMessage('');
    };

    // 다크 모드에서는 밝은 배경, 라이트 모드에서는 어두운 배경
    const backgroundColor = theme.palette.mode === 'dark' ? '#ffffff' : '#1e1e1e';
    const textColor = theme.palette.mode === 'dark' ? '#000000' : '#ffffff';

    return (
        <div
            className="
                fixed z-[999999]
                flex justify-center items-center
                drop-shadow-xl
                w-full fit-height left-0 top-0 animate-fade-in
            "
            onClick={handleClose}
        >
            <div
                className="
                    text-center
                    rounded-lg
                    p-6 mb-[100px]
                "
                style={{
                    backgroundColor,
                    color: textColor,
                }}
            >
                <div
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(contentListMessage),
                    }}
                ></div>
            </div>
        </div>
    );
}
