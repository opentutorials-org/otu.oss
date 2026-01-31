'use client';
import Image from 'next/image';
import { Conversation } from './Conversation';
import Input from './Input';
import s from './style.module.css';
import { useEffect, useState } from 'react';
import { GoToBottom } from './Conversation/GoToBottom';
import { Topbar } from './Conversation/Topbar';
import { ChatThemeProvider } from './ChatThemeProvider';
import { AIDisabledBanner } from './AIDisabledBanner';
export default function Root() {
    const [showScrollButton, setShowScrollButton] = useState(false);
    // 가상 키보드 활성화시 화면 전체를 밀어내도록 변경
    // useEffect(() => {
    //     // virtual keyboard 는 https에서만 동작합니다.
    //     if (typeof window === 'undefined' || !('virtualKeyboard' in navigator)) {
    //         return;
    //     }
    //     // @ts-ignore
    //     window.navigator.virtualKeyboard.overlaysContent = true;
    //     return () => {
    //         // @ts-ignore
    //         window.navigator.virtualKeyboard.overlaysContent = false;
    //     };
    // }, []);
    return (
        <ChatThemeProvider>
            <div
                id="chat_root"
                className="relative bg-[rgba(255,255,255,0.8)] dark:bg-[#212121] drop-shadow-sm"
            >
                <Topbar></Topbar>
                <AIDisabledBanner />
                <div
                    className={`${s.history_scrollpane} fit-height high-focus-bg-color`}
                    style={{
                        paddingTop: 'env(safe-area-inset-top)',
                    }}
                >
                    <Conversation
                        onLeaveBottom={(isLeave) => {
                            setShowScrollButton(isLeave);
                        }}
                    ></Conversation>
                    <Input showScrollButton={showScrollButton}></Input>
                </div>
            </div>
        </ChatThemeProvider>
    );
}
