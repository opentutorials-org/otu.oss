'use client';

import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import { Z_INDEX } from '@/constants';
import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect, ReactNode } from 'react';
import { useAtomValue } from 'jotai';
import { chatOpenState, drawerWidthState } from '@/lib/jotai';
import { useNavigation } from '@/hooks/useNavigation';
import { homeModalLogger } from '@/debug/home2';
import {
    MAX_CONTENT_WIDTH,
    TOP_LOGO_POSITION,
    TOP_HEIGHT,
    LOGO_SIZE,
    CONTENT_AREA_CLASS,
} from '@/utils/layoutConstants';
import { ChevronDownIcon } from '@heroicons/react/24/solid';

interface SwipeableModalProps {
    children: ReactNode;
    onClose?: () => void;
    sx?: object;
    zIndex?: number;
}

/**
 * 단순한 SwipeableModal - 부모 경로로 이동
 *
 * 주요 기능:
 * - children을 받는 간단한 wrapper 컴포넌트
 * - 닫기 시 항상 부모 경로로 이동 (계층적 뒤로가기)
 * - iOS Safari 호환성 및 헤더 영역 통합 (백버튼)
 */
export default function SwipeableModal({
    children,
    onClose,
    sx = {},
    zIndex = Z_INDEX.MODAL_BASE,
}: SwipeableModalProps) {
    const theme = useTheme();
    const { goBack, getCurrentSection } = useNavigation();
    const chatOpen = useAtomValue(chatOpenState);
    const drawerWidth = useAtomValue(drawerWidthState);
    const [windowWidth, setWindowWidth] = useState<number | null>(null);

    const currentSection = getCurrentSection();

    useEffect(() => {
        homeModalLogger('SwipeableModal 열림', { section: currentSection });
    }, []);

    // 뷰포트 폭 감지
    useEffect(function handleWindowResizeWatcher() {
        const handle = () => setWindowWidth(window.innerWidth);
        handle();
        window.addEventListener('resize', handle);
        return () => window.removeEventListener('resize', handle);
    }, []);

    const handleClose = () => {
        // aria-hidden 경고 방지를 위해 포커스 즉시 제거
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
            activeElement.blur();
        }

        homeModalLogger('SwipeableModal 닫기', { section: currentSection });

        if (onClose) {
            onClose();
        } else {
            goBack(); // 항상 부모 경로로 이동
        }
    };

    const handleOpen = () => {
        // SwipeableDrawer가 요구하는 prop이지만 실제로는 사용하지 않음
    };

    return (
        <SwipeableDrawer
            id="swipeable_modal"
            anchor="bottom"
            open={true}
            onClose={handleClose}
            onOpen={handleOpen}
            disableSwipeToOpen={false}
            ModalProps={{ keepMounted: true, disableEnforceFocus: true, disableAutoFocus: false }}
            sx={{
                zIndex,
                '& .MuiDrawer-paper': {
                    height: 'calc(var(--vh, 1vh) * 100)',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    overflow: 'hidden',
                    // iOS Safari rubber band 스크롤 충돌 방지
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    left: 0,
                    right:
                        chatOpen && (windowWidth ?? 0) - drawerWidth >= 680
                            ? `calc(env(safe-area-inset-right) + ${drawerWidth}px)`
                            : 'env(safe-area-inset-right)',
                    width: 'auto',
                    transition: 'right 0.2s ease',
                    backgroundColor: 'var(--bg-color) !important',
                    backgroundImage: 'none !important',
                    // 네이티브 안드로이드 웹뷰에서 키보드 표시 시 transform이 잘못 계산되는 문제 해결
                    transform: 'none !important', // android 과거 앱에서 텍스트 필드에 포커스를 주면 ui가 아래로 숨어버리는 현상이 있음. 이 문제를 해결하기 위해서 임시 조치함.
                    ...sx,
                },
            }}
        >
            <Box
                role="presentation"
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    marginTop: 'calc(env(safe-area-inset-top) / 2)',
                }}
            >
                {/* 헤더 영역 - Top 컴포넌트와 동일한 구조 */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        width: '100%',
                        height: TOP_HEIGHT,
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            width: '100%',
                            maxWidth: MAX_CONTENT_WIDTH,
                            px: '0', // Top 컴포넌트의 px-1과 동일
                            pt: 'var(--native-top-inset, env(safe-area-inset-top))',
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        {/* 닫기 버튼 - Top 컴포넌트 Logo와 정확히 동일한 위치 */}
                        <IconButton
                            onClick={handleClose}
                            aria-label="닫기"
                            sx={{
                                position: 'absolute',
                                left: 8,
                                width: LOGO_SIZE,
                                height: LOGO_SIZE,
                                pl: 1,
                                '& .MuiSvgIcon-root': {
                                    fontSize: '24px',
                                },
                            }}
                        >
                            <ChevronDownIcon width="20" height="20" className="stroke-text-color" />
                        </IconButton>
                    </Box>
                </Box>

                {/* 컨텐츠 영역 - 단순화 */}
                <Box
                    id="swipeable_modal_content"
                    sx={{
                        flex: 1,
                        overflowY: 'scroll',
                        overflowX: 'auto',
                        display: 'flex',
                        justifyContent: 'center',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <Box
                        sx={{
                            width: '100%',
                            maxWidth: MAX_CONTENT_WIDTH,
                        }}
                    >
                        {children}
                    </Box>
                </Box>
            </Box>
        </SwipeableDrawer>
    );
}
