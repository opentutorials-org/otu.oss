'use client';
import { useAtom } from 'jotai';
import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { themeModeState } from '@/lib/jotai';
import { grey } from '@mui/material/colors';
import { ThemeOptions } from '@mui/system';

export const MuiThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themeMode] = useAtom(themeModeState);
    const [isHydrated, setIsHydrated] = useState(false);

    // Prevent hydration mismatch: use default theme until client-side hydration completes
    // This ensures server-rendered HTML matches initial client render
    useEffect(() => {
        setIsHydrated(true);
    }, []);

    // Use 'gray' during SSR and initial render, then switch to stored theme
    const effectiveThemeMode = isHydrated ? themeMode : 'gray';
    const darkMode = effectiveThemeMode === 'black';

    const themeOption: ThemeOptions = {
        palette: {
            mode: darkMode ? 'dark' : 'light',
            primary: {
                // light: '#ff0000',
                main: darkMode ? '#dfe2dd' : '#2c2f7e', // 기본 배경 색상
                // dark: '#00ff00', // 호버시 배경 색상
                // contrastText: darkMode ? '#262626' : '#dfe2dd', // 텍스트 색상
            },
            background: {
                paper: 'var(--bg-color)', // Paper의 배경색
            },
        },
        typography: {
            fontFamily: 'inherit',
        },
        components: {
            MuiCheckbox: {
                styleOverrides: {
                    root: {
                        color: 'var(--text-color)',
                        '&.Mui-checked': {
                            color: 'var(--text-color)',
                        },
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        color: 'var(--text-color) !important',
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        boxShadow: 'none', // 버튼의 그림자 제거
                        textTransform: 'none',
                        borderRadius: '3px', // 빠른 메모와 동일한 border-radius
                        fontSize: '13px',
                        fontWeight: 'bold',
                        fontFamily: 'Noto Sans KR',
                        padding: '8px 30px',
                        '&:hover': {
                            boxShadow: 'none', // 호버 상태에서도 그림자 제거
                        },
                    },
                    containedSecondary: {
                        // color prop이 지정되지 않은 contained variant에 대한 스타일
                        backgroundColor: 'var(--high-contrast-bg-color)',
                        color: 'var(--text-color)', // 배경색이 어두우므로 텍스트 색상을 흰색으로 지정
                        border: '1px solid var(--border-color)',
                    },
                    containedPrimary: {
                        backgroundColor: 'var(--text-color)',
                        color: 'var(--inverted-text-color)',
                    },
                },
            },
            MuiToggleButtonGroup: {
                styleOverrides: {
                    grouped: {
                        borderColor: 'var(--border-color)', // ToggleButton의 테두리 색상을 --border-color로 지정
                        '&.Mui-selected': {
                            borderColor: 'var(--border-color)', // 선택된 상태에서도 테두리 유지
                        },
                        '&:first-of-type': {
                            borderRadius: '3px 0 0 3px', // 첫 번째 버튼의 왼쪽 모서리만 둥글게
                        },
                        '&:last-of-type': {
                            borderRadius: '0 3px 3px 0', // 마지막 버튼의 오른쪽 모서리만 둥글게
                        },
                        '&:not(:first-of-type):not(:last-of-type)': {
                            borderRadius: '0', // 중간 버튼들은 직각
                        },
                    },
                    root: {
                        // small 크기일 때 스타일
                        '&.MuiToggleButtonGroup-sizeSmall': {
                            '& .MuiToggleButton-root': {
                                padding: '4px 8px', // small 크기일 때 패딩
                                fontSize: '0.75rem', // small 크기일 때 폰트 크기
                                minWidth: '32px', // 최소 폭 설정
                                '& svg': {
                                    width: '16px', // small 크기일 때 아이콘 크기
                                    height: '16px',
                                },
                            },
                        },
                        // medium 크기일 때 스타일
                        '&.MuiToggleButtonGroup-sizeMedium': {
                            '& .MuiToggleButton-root': {
                                padding: '6px 12px', // medium 크기일 때 패딩
                                fontSize: '0.875rem', // medium 크기일 때 폰트 크기
                                minWidth: '40px', // 최소 폭 설정
                                '& svg': {
                                    width: '20px', // medium 크기일 때 아이콘 크기
                                    height: '20px',
                                },
                            },
                        },
                        // large 크기일 때 스타일
                        '&.MuiToggleButtonGroup-sizeLarge': {
                            '& .MuiToggleButton-root': {
                                padding: '8px 16px', // large 크기일 때 패딩
                                fontSize: '1rem', // large 크기일 때 폰트 크기
                                minWidth: '48px', // 최소 폭 설정
                                '& svg': {
                                    width: '24px', // large 크기일 때 아이콘 크기
                                    height: '24px',
                                },
                            },
                        },
                    },
                },
            },
            MuiToggleButton: {
                styleOverrides: {
                    root: {
                        '& svg': {
                            color: 'var(--text-color)', // svg 아이콘의 색상을 --text-color로 지정
                        },
                        borderColor: 'var(--border-color)', // ToggleButton의 테두리 색상 지정
                        borderRadius: '3px', // 빠른 메모와 동일한 border-radius
                        '&.Mui-selected': {
                            backgroundColor: 'var(--focus-bg-color)', // 다크모드에 따른 선택된 버튼의 배경색 설정
                            '& svg': {
                                color: 'var(--text-color)', // 선택된 상태에서도 svg의 색상 유지
                            },
                        },
                        // small 크기일 때 스타일
                        '&.MuiToggleButton-sizeSmall': {
                            padding: '4px 8px', // small 크기일 때 패딩
                            fontSize: '0.75rem', // small 크기일 때 폰트 크기
                            minWidth: '32px', // 최소 폭 설정
                            '& svg': {
                                width: '16px', // small 크기일 때 아이콘 크기
                                height: '16px',
                            },
                        },
                        // medium 크기일 때 스타일
                        '&.MuiToggleButton-sizeMedium': {
                            padding: '6px 12px', // medium 크기일 때 패딩
                            fontSize: '0.875rem', // medium 크기일 때 폰트 크기
                            minWidth: '40px', // 최소 폭 설정
                            '& svg': {
                                width: '20px', // medium 크기일 때 아이콘 크기
                                height: '20px',
                            },
                        },
                        // large 크기일 때 스타일
                        '&.MuiToggleButton-sizeLarge': {
                            padding: '8px 16px', // large 크기일 때 패딩
                            fontSize: '1rem', // large 크기일 때 폰트 크기
                            minWidth: '48px', // 최소 폭 설정
                            '& svg': {
                                width: '24px', // large 크기일 때 아이콘 크기
                                height: '24px',
                            },
                        },
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        paddingTop: 'calc(var(--native-top-inset, env(safe-area-inset-top)))',
                        paddingBottom:
                            'calc(var(--native-bottom-inset, env(safe-area-inset-bottom)))',
                        minWidth: '350px', // 다이얼로그의 최소 폭 설정
                        backgroundColor: 'var(--modal-bg-color)',
                        backgroundImage: 'none', // 다크모드에 따른 배경색 변경
                        borderRadius: '3px', // 빠른 메모와 동일한 border-radius
                        boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.12)', // 그림자 효과 추가
                        overflow: 'hidden', // 내용이 모서리를 넘어가지 않도록 설정
                        '&.MuiDialog-paperFullScreen': {
                            '& .MuiDialogActions-root': {
                                padding: '20px 0', // 전체 화면일 때 기본 패딩값으로 복원
                            },
                        },
                    },
                    root: {
                        '& .MuiBackdrop-root': {
                            backgroundColor: darkMode
                                ? 'rgba(0, 0, 0, 0.7)'
                                : 'rgba(255, 255, 255, 0.7)', // 백드롭 색상 조정
                        },
                    },
                },
            },
            MuiDialogContentText: {
                styleOverrides: {
                    root: {
                        color: 'var(--text-color)', // DialogContentText의 색상을 --text-color로 설정
                    },
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: {
                        padding: 15,
                        paddingBottom: '50px',
                        justifyContent: 'center', // 버튼을 가운데 정렬
                    },
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        padding: '16px 24px',
                        borderBottom: '1px solid var(--border-color)', // 제목 아래 경계선 추가
                    },
                },
            },
            MuiDialogContent: {
                styleOverrides: {
                    root: {
                        padding: '20px 24px',
                        paddingTop: '40px',
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: {
                        backgroundColor: 'var(--modal-bg-color)', // 다크모드에 따른 배경색 변경
                        borderRadius: '3px', // 빠른 메모와 동일한 border-radius
                    },
                },
            },
            MuiTypography: {
                styleOverrides: {
                    body1: {
                        color: 'var(--text-color)', // Typography의 body1 변형의 색상을 --text-color로 설정
                    },
                },
            },
            MuiIconButton: {
                // Add style overrides for IconButton
                styleOverrides: {
                    root: {
                        color: 'var(--text-color)',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        // MuiPaper의 root 슬롯 오버라이드
                        color: 'var(--text-color)',
                        borderRadius: '3px', // 빠른 메모와 동일한 border-radius
                    },
                },
            },
            MuiSnackbar: {
                styleOverrides: {
                    root: {
                        '&.MuiSnackbar-anchorOriginTopCenter': {
                            marginTop: 'calc(env(safe-area-inset-top) + 16px)', // 위쪽 안전 영역
                        },
                        '&.MuiSnackbar-anchorOriginBottomCenter': {
                            marginBottom: 'calc(env(safe-area-inset-bottom) + 16px)', // 아래쪽 안전 영역
                        },
                        '&.MuiSnackbar-anchorOriginTopLeft': {
                            marginTop: 'calc(env(safe-area-inset-top) + 16px)', // 위쪽 안전 영역
                        },
                        '&.MuiSnackbar-anchorOriginBottomLeft': {
                            marginBottom: 'calc(env(safe-area-inset-bottom) + 16px)', // 아래쪽 안전 영역
                        },
                        '&.MuiSnackbar-anchorOriginTopRight': {
                            marginTop: 'calc(env(safe-area-inset-top) + 16px)', // 위쪽 안전 영역
                        },
                        '&.MuiSnackbar-anchorOriginBottomRight': {
                            marginBottom: 'calc(env(safe-area-inset-bottom) + 16px)', // 아래쪽 안전 영역
                        },
                    },
                },
            },
            MuiAccordion: {
                styleOverrides: {
                    root: {
                        backgroundColor: 'transparent', // Accordion의 배경색
                        boxShadow: 'none',
                        '&::before': {
                            opacity: '1 !important', // ::before의 opacity를 항상 1로 지정
                        },
                        '&.MuiPaper-root': {
                            backgroundColor: 'transparent !important',
                            background: 'none !important',
                        },
                    },
                },
            },
            MuiAccordionSummary: {
                styleOverrides: {
                    root: {
                        backgroundColor: 'transparent',
                        '&.Mui-expanded': {
                            backgroundColor: 'transparent',
                        },
                        '&:hover': {
                            backgroundColor: 'transparent',
                        },
                    },
                },
            },
            MuiAccordionDetails: {
                styleOverrides: {
                    root: {
                        shadow: 'none',
                        backgroundColor: 'transparent',
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    popper: {
                        zIndex: 10000, // 기존 의도 유지: 채팅창보다 높게
                    },
                },
            },
        },
    };

    // @ts-ignore
    const theme = createTheme(themeOption);

    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
