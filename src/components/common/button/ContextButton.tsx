import { keyframes, styled } from '@mui/material/styles';
import Button from '@mui/material/Button';

const fadeIn = keyframes`
from {
  opacity: 0;
}
to {
  opacity: 1;
}
`;

const ContextButton = styled(Button)(({ theme }) => ({
    animation: `${fadeIn} 0.3s ease-in-out`,
    borderRadius: '50px',
    opacity: 0.7,
    // border: "1px solid",
    borderColor: theme.palette.mode === 'dark' ? '#ffffff1f' : '#0000001f',
    whiteSpace: 'nowrap',
    backgroundColor: theme.palette.mode === 'dark' ? '#000 !important' : '#fff !important',
    color: theme.palette.mode === 'dark' ? '#fff' : '#000',
    '&:hover': {
        backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#eee',
        borderColor: theme.palette.mode === 'dark' ? 'white' : 'black',
    },
    '&:disabled': {
        opacity: 0.3,
    },
}));

export default ContextButton;
