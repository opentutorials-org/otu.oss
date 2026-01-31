import IconButton from '@mui/material/IconButton';
import Image from 'next/image';

export function Btn({
    onClick,
    src,
    alt,
}: {
    onClick: () => void;
    src: React.ReactElement;
    alt: string;
}) {
    return (
        <div className="right-[10px]" onClick={onClick}>
            <IconButton size="small" className="relative">
                {src}
            </IconButton>
        </div>
    );
}
