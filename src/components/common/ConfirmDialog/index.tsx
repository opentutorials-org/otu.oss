import React, { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { useLingui } from '@lingui/react/macro';
import DOMPurify from 'dompurify';
import { confirmState, closeConfirmState } from '@/lib/jotai'; // 경로는 프로젝트 설정에 맞게 조정하세요.
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import s from './index.module.css';
import { Z_INDEX } from '@/constants';

export default function ConfirmDialog() {
    const { t } = useLingui();
    const [confirm] = useAtom(confirmState);
    const [, closeConfirm] = useAtom(closeConfirmState);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isCentered, setIsCentered] = useState(false); // 기본값은 왼쪽 정렬
    const frameIdRef = useRef<number | null>(null);
    const [isContentVisible, setIsContentVisible] = useState(false); // 콘텐츠 가시성 상태
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isFullscreen = !!(confirm.fullscreen && isMobile);

    const handleYes = () => {
        if (confirm.onYes) confirm.onYes();
        closeConfirm();
    };

    const handleNo = () => {
        if (confirm.onNo) confirm.onNo();
        closeConfirm();
    };

    useEffect(() => {
        // @ts-ignore
        const handleKeyDown = (event) => {
            if (event.keyCode === 13 && confirm.open) {
                handleYes();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [confirm.open]);

    useEffect(() => {
        // 다이얼로그가 열리면 콘텐츠를 일단 숨김
        if (confirm.open) {
            setIsContentVisible(false);
        }
    }, [confirm.open]);

    useEffect(() => {
        // 텍스트 너비 확인 및 정렬 방식 결정 함수
        const checkTextWidth = () => {
            if (contentRef.current) {
                const contentElement = contentRef.current;

                // 내용물의 실제 너비를 계산하기 위해 텍스트를 복제하여 임시로 측정
                const tempSpan = document.createElement('span');
                tempSpan.innerHTML = DOMPurify.sanitize(confirm.message);
                tempSpan.style.position = 'absolute';
                tempSpan.style.visibility = 'hidden';
                tempSpan.style.whiteSpace = 'nowrap';
                tempSpan.style.fontSize = window.getComputedStyle(contentElement).fontSize;
                document.body.appendChild(tempSpan);

                const textWidth = tempSpan.offsetWidth;
                document.body.removeChild(tempSpan);

                // 부모 컨테이너의 너비 구하기
                const containerWidth = contentElement.parentElement?.clientWidth || 0;

                // 텍스트 너비가 컨테이너보다 크면 왼쪽 정렬, 작으면 중앙 정렬
                const shouldCenter = textWidth < containerWidth * 0.9; // 90% 조건으로 변경

                // 정렬 방식 설정 및 콘텐츠 표시
                setIsCentered(shouldCenter);
                setIsContentVisible(true); // 계산 후 콘텐츠 표시
            }
        };

        // 다이얼로그가 열릴 때 너비 확인
        const handleCheckWidth = () => {
            // 이전 프레임 요청 취소
            if (frameIdRef.current !== null) {
                cancelAnimationFrame(frameIdRef.current);
            }
            // 다음 프레임에서 계산 (렌더링 완료 후)
            frameIdRef.current = requestAnimationFrame(() => {
                checkTextWidth();
                frameIdRef.current = null;
            });
        };

        if (confirm.open) {
            // 다이얼로그가 열리고 렌더링이 완료된 후 계산
            handleCheckWidth();
        }

        // 창 크기 변경 시 다시, 콘텐츠 숨기고 다시 계산
        const handleResize = () => {
            if (confirm.open) {
                setIsContentVisible(false); // 크기 변경 시 콘텐츠 숨김
                handleCheckWidth();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            // 클린업 시 애니메이션 프레임 요청 취소
            if (frameIdRef.current !== null) {
                cancelAnimationFrame(frameIdRef.current);
            }
        };
    }, [confirm.open, confirm.message]);

    return (
        <Dialog
            open={confirm.open}
            onClose={confirm.closeOnBackdropClick !== false ? handleNo : undefined}
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            sx={{ zIndex: Z_INDEX.CONFIRM_DIALOG }}
            fullScreen={isFullscreen}
        >
            <DialogContent>
                <DialogContentText id="confirm-dialog-description" component="div">
                    <div
                        ref={contentRef}
                        className={`${s.content} ${isCentered ? s.contentCentered : ''} ${isContentVisible ? s.visible : s.hidden}`}
                        dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(confirm.message),
                        }}
                    ></div>
                    {confirm.customContent && (
                        <div className={s.customContent}>{confirm.customContent}</div>
                    )}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                {confirm.onNo && (
                    <Button onClick={handleNo} color="secondary" variant="contained" autoFocus>
                        {confirm.noLabel ? confirm.noLabel : t`취소`}
                    </Button>
                )}
                {confirm.onYes && (
                    <Button onClick={handleYes} color="primary" variant="contained">
                        {confirm.yesLabel ? confirm.yesLabel : t`확인`}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
