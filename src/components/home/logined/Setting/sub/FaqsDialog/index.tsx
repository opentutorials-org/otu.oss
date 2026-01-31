import Faq from '@/components/common/Faq';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import { useTheme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';

interface FaqsDialogProps {
    onClose: () => void;
    isFullScreen?: boolean;
}

/**
 * FaqsDialog 컴포넌트
 * - FAQ를 보여주는 다이얼로그
 * - Dialog를 사용하여 모달 형태로 표시
 * - 모바일 화면에서는 전체 화면으로 표시 (fullScreen prop)
 */

export default function FaqsDialog({ onClose, isFullScreen = false }: FaqsDialogProps) {
    const theme = useTheme();
    const [fullScreen, setFullScreen] = useState(isFullScreen);
    const [cols, setCols] = useState(1); // default column
    const dialogRef = useRef<HTMLDivElement | null>(null);

    const toggleFullScreen = () => {
        setFullScreen((prev) => !prev); // fullScreen 상태 토글
    };

    useEffect(() => {
        const calculateCols = (width: number) => {
            if (width > 600) return 3; // 큰 화면
            return 1; // 작은 화면
        };

        if (fullScreen) {
            // fullScreen일 때는 미디어 쿼리에 따라 cols 계산
            const screenWidth = window.innerWidth;
            setCols(calculateCols(screenWidth));
        } else {
            // fullScreen이 아닐 때는 모달 크기에 따라 cols 계산
            const observer = new ResizeObserver((entries) => {
                if (!entries.length) return;
                const { width } = entries[0].contentRect;
                setCols(calculateCols(width));
            });

            if (dialogRef.current) {
                observer.observe(dialogRef.current);
            }

            return () => {
                if (dialogRef.current) {
                    observer.unobserve(dialogRef.current);
                }
            };
        }
    }, [fullScreen]);

    return (
        <Dialog
            open={true}
            fullScreen={fullScreen}
            onClose={onClose}
            PaperProps={{
                ref: dialogRef,
                style: {
                    padding: '5px',
                    minWidth: '400',
                    minHeight: '300px',
                },
            }}
        >
            <DialogTitle>FAQs</DialogTitle>

            <DialogContent>
                <Faq isModal={true} />
            </DialogContent>
            {/* <!-- 풀스크린여하에 따른 레이아웃 구성 확인을 위한 버튼으로 주석 처리합니다. --> */}
            {/* <DialogActions>
                <button onClick={toggleFullScreen}>
                    {fullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
            </DialogActions> */}
        </Dialog>
    );
}
