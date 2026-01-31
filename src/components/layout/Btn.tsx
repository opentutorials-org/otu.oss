'use client';

import LoadingIcon from '@/public/icon/loading';

export function Btn({
    children,
    onClick,
    disabled = false,
    border = true,
    loading = false,
}: {
    children: React.ReactNode;
    onClick: (event: any) => void;
    disabled?: boolean;
    border?: boolean;
    loading?: boolean;
}) {
    return (
        <button
            onClick={(evt) => {
                // Prevent multiple clicks by adding blur effect
                evt.currentTarget.blur();
                if (!loading) {
                    onClick(evt);
                }
            }}
            className={`h-[48px] border-color${border ? ' border-[1px] ' : ' '}text-color text-[14px] font-bold flex justify-center max-w-[348px] w-full items-center gap-1 rounded-[3px] disabled:cursor-not-allowed click-animation`}
            disabled={disabled || loading}
        >
            {loading ? (
                <>
                    <LoadingIcon />
                </>
            ) : (
                children
            )}
        </button>
    );
}
