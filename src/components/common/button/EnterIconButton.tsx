import IconButton from '@mui/material/IconButton';
import ArrowCircleUpIcon from '@mui/icons-material/ArrowCircleUp';
type EnterIconButtonProps = {
    disabled?: boolean;
    onClick: () => void;
    className?: string;
};
export const EnterIconButton: React.FC<EnterIconButtonProps> = ({
    disabled,
    onClick,
    className,
}) => {
    return (
        <IconButton
            disabled={disabled}
            onClick={() => {
                onClick();
            }}
            style={{ padding: 0 }}
            className={className}
        >
            <ArrowCircleUpIcon />
        </IconButton>
    );
};
