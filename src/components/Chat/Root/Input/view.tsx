import React, { FormEvent, useRef, useState, useEffect } from 'react';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import IconButton from '@mui/material/IconButton';
import TextareaAutosize from '@mui/material/TextareaAutosize';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { EnterIconButton } from '../../../common/button/EnterIconButton';
import { OptionItem, isDarkModeAtom, openConfirmState } from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { forceScroll } from '@/functions/forceRepaint';
import { useRouter } from 'next/navigation';
import { GoToBottom } from '../Conversation/GoToBottom';
import { useTranslations } from 'next-intl';

type TextInputProps = {
    value: string;
    onChange: (value: string) => void;
    style?: React.CSSProperties;
    className?: string;
    placeholder?: string;
    onSubmit: (
        value: string,
        option: {
            ai: OptionItem | null;
            rag: string;
        }
    ) => void;
    showScrollButton: boolean;
};

export function View({
    value,
    onChange,
    onSubmit,
    className,
    placeholder,
    showScrollButton,
}: TextInputProps) {
    const t = useTranslations('chat');
    const router = useRouter();
    const [isComposing, setIsComposing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [selectedRagOption, setSelectedRagOption] = useState<string>('none');
    const [isFocused, setIsFocused] = useState(false);
    const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState(false);
    const [supportsVisualViewport, setSupportsVisualViewport] = useState(false);
    const openConfirm = useSetAtom(openConfirmState);
    const isDarkMode = useAtomValue(isDarkModeAtom);

    useEffect(function detectMobileDevice() {
        const isMobileDevice =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            );
        setIsMobileDevice(isMobileDevice);

        // Visual Viewport API 지원 여부 확인
        setSupportsVisualViewport(!!window.visualViewport);
    }, []);

    // 가상 키보드 감지 (Visual Viewport API 지원 시에만)
    useEffect(
        function detectVirtualKeyboard() {
            if (!isMobileDevice || !supportsVisualViewport) return;

            const initialViewportHeight = window.visualViewport?.height || window.innerHeight;

            const handleViewportChange = () => {
                const currentHeight = window.visualViewport?.height || window.innerHeight;
                const heightDifference = initialViewportHeight - currentHeight;

                // 높이 차이가 150px 이상이면 가상 키보드가 열린 것으로 판단
                setIsVirtualKeyboardOpen(heightDifference > 150);
            };

            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', handleViewportChange);
                return () => {
                    window.visualViewport?.removeEventListener('resize', handleViewportChange);
                };
            }
        },
        [isMobileDevice, supportsVisualViewport]
    );

    // 채팅창이 열릴 때 자동으로 입력창에 포커스 설정
    useEffect(function focusTextareaOnMount() {
        // 컴포넌트가 마운트된 후 입력창에 포커스
        if (textareaRef.current) {
            // setTimeout을 사용하여 DOM이 완전히 렌더링된 후 포커스 설정
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, []);

    const historyManger = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const capture = ['Enter', 'ArrowUp', 'ArrowDown', 'Escape'];
        if (!capture.includes(e.key)) return false;
        const textField = e.target as HTMLInputElement;
        const isCursorStart = textField.selectionStart === 0;
        const isCursorEnd = textField.selectionStart === textField.value.length;

        if (!isMobileDevice) {
            if (e.key === 'Enter' && e.shiftKey && !isComposing) {
                // Desktop: Shift+Enter inserts a newline
                e.preventDefault();
                onChange(e.currentTarget.value + '\n');
                return;
            } else if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                // Desktop: Enter submits the form
                e.preventDefault();
                if (e.currentTarget.value.trim() === '') {
                    return;
                }
                // Update history
                const newHistoryIndex = historyIndex + 1;
                setHistoryIndex(newHistoryIndex);
                const newHistory = history.slice(0, newHistoryIndex);
                setHistory(newHistory);
                // Trigger onSubmit
                onSubmit(e.currentTarget.value, {
                    ai: null,
                    rag: selectedRagOption,
                });
                return;
            }
        } else {
            if (e.key === 'Enter' && !isComposing) {
                // Mobile: Allow default behavior (inserts newline)
                return;
            }
        }

        // Handle history navigation with ArrowUp and ArrowDown
        if (e.key === 'ArrowUp' && isCursorStart) {
            if (historyIndex > 0) {
                const newHistoryIndex = historyIndex - 1;
                setHistoryIndex(newHistoryIndex);
                onChange(history[newHistoryIndex]);
                setTimeout(() => {
                    textField.setSelectionRange(0, 0);
                });
                e.preventDefault();
            }
        } else if (e.key === 'ArrowDown' && isCursorEnd) {
            if (historyIndex + 1 < history.length) {
                e.preventDefault();
                const newHistoryIndex = historyIndex + 1;
                setHistoryIndex(newHistoryIndex);
                onChange(history[newHistoryIndex]);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        historyManger(e);
    };

    return (
        <div className="flex-none relative">
            <GoToBottom open={showScrollButton} />
            <div
                id="message_root"
                className="w-full px-[10px] z-40"
                style={{
                    paddingBottom: (supportsVisualViewport ? isVirtualKeyboardOpen : isFocused)
                        ? '20px'
                        : 'calc(var(--native-bottom-inset, env(safe-area-inset-bottom)) + 20px)',
                }}
            >
                <div className="p-1 ml-[-8px] relative flex justify-end">
                    <Select
                        sx={{
                            marginRight: -1.5,
                            '.MuiSelect-select': {
                                padding: 0,
                                color: 'var(--text-color)',
                                fontSize: '0.65rem',
                                fontWeight: 'normal',
                            },
                            '& fieldset': {
                                border: 'none',
                            },
                            '& .MuiSelect-select': {
                                fontSize: '0.75rem',
                                fontWeight: '600',
                            },
                            '& .MuiSelect-icon': {
                                color: isDarkMode ? 'white' : 'black',
                            },
                        }}
                        MenuProps={{
                            sx: {
                                zIndex: 99999, // 기존 의도 유지: 매우 높은 값 필요
                            },
                            anchorOrigin: {
                                vertical: 'top',
                                horizontal: 'left',
                            },
                            transformOrigin: {
                                vertical: 'bottom',
                                horizontal: 'left',
                            },
                        }}
                        value={selectedRagOption}
                        onChange={(e) => setSelectedRagOption(e.target.value)}
                        displayEmpty
                        inputProps={{ 'aria-label': 'Without label' }}
                    >
                        <MenuItem value="none">{t('search-scope')}</MenuItem>
                        <MenuItem value="all">{t('search-all')}</MenuItem>
                        <MenuItem value="current">{t('search-current')}</MenuItem>
                    </Select>
                </div>
                <div className="flex items-end rounded-[22px] p-[6px] bg-color">
                    <TextareaAutosize
                        ref={textareaRef}
                        spellCheck={false}
                        className={`${className ? className : ''} bg-transparent pl-2 p-1 w-full outline-none text-[16px] resize-none placeholder-[rgba(0,0,0,0.2)] dark:placeholder-[rgba(255,255,255,0.2)]`}
                        value={value}
                        placeholder={placeholder}
                        onFocus={(evt) => {
                            setIsFocused(true);
                        }}
                        onChange={(e) => {
                            e.preventDefault();
                            onChange(e.currentTarget.value);
                            let newHistory = [...history];
                            newHistory[historyIndex] = e.currentTarget.value;
                            newHistory = newHistory.slice(0, historyIndex + 1);
                            setHistory(newHistory);
                        }}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={() => {
                            setIsComposing(true);
                        }}
                        onCompositionEnd={() => {
                            setIsComposing(false);
                        }}
                        onBlur={() => {
                            setIsFocused(false);
                            setTimeout(() => {
                                forceScroll();
                            }, 0);
                        }}
                    />
                    <div className={value?.length > 0 ? 'pb-1' : 'hidden'}>
                        <EnterIconButton
                            onClick={() => {
                                onSubmit(value, {
                                    ai: null,
                                    rag: selectedRagOption,
                                });
                            }}
                        ></EnterIconButton>
                    </div>
                </div>
            </div>
        </div>
    );
}

function diff(previous: string, current: string) {
    return current.split('').find((char, i) => char !== previous[i]);
}
