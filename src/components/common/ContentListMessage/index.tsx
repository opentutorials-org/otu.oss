import { useAtom } from 'jotai';
import { contentListMessageState } from '@/lib/jotai';
import { useTranslations } from 'next-intl';

export default function ContentListMessage() {
    const [contentListMessage, setContentListMessage] = useAtom(contentListMessageState);
    const tError = useTranslations('error');

    if (contentListMessage === '') {
        return null;
    }

    const handleClose = () => {
        setContentListMessage('');
    };

    return (
        <div
            className="
                fixed z-[999999]
                flex justify-center items-center
                drop-shadow-xl
                w-full fit-height left-0 top-0 text-black dark:text-white animate-fade-in
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
                    backgroundColor: 'var(--high-contrast-bg-color)',
                }}
            >
                <div
                    dangerouslySetInnerHTML={{
                        __html: tError('append-to-page', {
                            title: contentListMessage,
                        }),
                    }}
                ></div>
            </div>
        </div>
    );
}
