'use client';
import { useAtom } from 'jotai';
import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { themeModeState } from '@/lib/jotai';
import { grey } from '@mui/material/colors';
import { ThemeOptions } from '@mui/system';

export const ChatThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [themeMode] = useAtom(themeModeState);
    const darkMode = themeMode === 'black';

    const themeOption: ThemeOptions = {
        palette: {
            mode: darkMode ? 'dark' : 'light',
            primary: grey,
            background: {
                paper: 'var(--high-focus-bg-color)', // Paper의 배경색
            },
        },
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        color: 'var(--text-color) !important',
                        '&.Mui-disabled': {
                            opacity: 0.5,
                        },
                    },
                },
            },
            MuiButtonBase: {
                styleOverrides: {
                    root: {
                        color: 'var(--text-color) !important',
                    },
                },
            },
            MuiSvgIcon: {
                styleOverrides: {
                    root: {
                        color: 'var(--text-color) !important',
                    },
                },
            },
        },
    };

    // @ts-ignore
    const theme = createTheme(themeOption);

    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
