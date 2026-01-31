import React from 'react';
import Image from 'next/image';

/**
 * 채팅 로딩 컴포넌트
 * 채팅 UI가 로드되는 동안 표시되는 전체 화면 로딩 오버레이
 */
const ChatLoading = () => (
    <div className="fixed inset-0 flex justify-center items-center h-screen w-full z-[9999] bg-white dark:bg-[#1d1d1d] bg-opacity-75 dark:bg-opacity-75">
        <Image
            src="/icon/redactor-ai-loading.svg"
            height="39"
            width="39"
            alt="loading"
            className="otu_loading mx-auto"
        />
    </div>
);

export default ChatLoading;
