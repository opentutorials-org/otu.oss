'use client';

import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { StyledEngineProvider } from '@mui/material/styles';
import { useState, useEffect, useRef } from 'react';
import Popover from '@mui/material/Popover';
import MuiAlert from '@mui/material/Alert';
// BlockNote 스타일 가져오기
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import '@/app/blocknote.css';
import './style.css';
import { publishLogger } from '@/debug/publish';
import dynamic from 'next/dynamic';
import { useLingui } from '@lingui/react/macro';

// BlockNote 관련 컴포넌트를 클라이언트 사이드에서만 로드하도록 설정
const BlockNoteEditor = dynamic(() => import('./BlockNoteClient').then((mod) => mod.default), {
    ssr: false,
});

interface SharePageContentProps {
    title: string;
    body: string;
    formattedDate: string;
    nickname: string;
    profileImgUrl: string | null;
}

export default function SharePageContent({
    title,
    body,
    formattedDate,
    nickname,
    profileImgUrl,
}: SharePageContentProps) {
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const linkButtonRef = useRef<HTMLButtonElement>(null);
    const { t } = useLingui();

    publishLogger('SharePageContent: Initializing client component');

    useEffect(() => {
        document.documentElement.className = 'gray';
    }, []);

    // 팝오버 닫기 핸들러
    const handlePopoverClose = (_: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
        setOpenSnackbar(false);
    };

    // Alert 닫기 핸들러
    const handleAlertClose = (event: React.SyntheticEvent) => {
        setOpenSnackbar(false);
    };

    // URL 복사 핸들러
    const handleCopyLink = () => {
        publishLogger('SharePageContent: Copy link button clicked');
        const currentURL = window.location.href;
        navigator.clipboard
            .writeText(currentURL)
            .then(() => {
                publishLogger('SharePageContent: URL copied successfully');
                setOpenSnackbar(true);
                // 3초 후 자동으로 닫기
                setTimeout(() => {
                    setOpenSnackbar(false);
                    publishLogger('SharePageContent: Copy notification auto-closed');
                }, 3000);
            })
            .catch((err) => {
                publishLogger('SharePageContent: URL copy failed', err);
                console.error('URL 복사 실패:', err);
            });
    };

    // MUI 테마 생성 - 최소화된 설정으로 변경
    const theme = createTheme({});

    publishLogger('SharePageContent: Rendering component');

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
                <div className="flex flex-col min-h-screen">
                    {/* 헤더와 본문을 감싸는 컨테이너 */}
                    <div className="flex-grow flex flex-col justify-center overflow-y-auto overflow-x-hidden">
                        {/* 헤더 - 화면 전체 너비로 확장 */}
                        <div
                            className={`w-full ${body.trim() ? 'border-b-[1px] border-[#2C2F7E]/20' : ''}`}
                        >
                            <div className="max-w-[549px] w-full mx-auto flex flex-col px-[34px] sm:px-0">
                                <div className="pt-[31px] pb-0">
                                    <h1 className="text-[1.5rem] font-bold text-[#2C2F7E] break-words">
                                        {title}
                                    </h1>
                                </div>
                                <div
                                    className={`pt-[4px] pb-[28px] flex flex-wrap items-center space-x-2  text-[#2C2F7E] transition-opacity duration-300}`}
                                >
                                    <span className="opacity-45 hover:opacity-100 text-[13px]">
                                        {formattedDate}
                                    </span>
                                    <button
                                        ref={linkButtonRef}
                                        className="flex items-center gap-1 ml-2 text-[100px] bg-transparent border-0 cursor-pointer opacity-45 hover:opacity-100"
                                        onClick={handleCopyLink}
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="size-4"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M8.914 6.025a.75.75 0 0 1 1.06 0 3.5 3.5 0 0 1 0 4.95l-2 2a3.5 3.5 0 0 1-5.396-4.402.75.75 0 0 1 1.251.827 2 2 0 0 0 3.085 2.514l2-2a2 2 0 0 0 0-2.828.75.75 0 0 1 0-1.06Z"
                                                clipRule="evenodd"
                                            />
                                            <path
                                                fillRule="evenodd"
                                                d="M7.086 9.975a.75.75 0 0 1-1.06 0 3.5 3.5 0 0 1 0-4.95l2-2a3.5 3.5 0 0 1 5.396 4.402.75.75 0 0 1-1.251-.827 2 2 0 0 0-3.085-2.514l-2 2a2 2 0 0 0 0 2.828.75.75 0 0 1 0 1.06Z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>

                                    <Popover
                                        open={openSnackbar}
                                        anchorEl={linkButtonRef.current}
                                        onClose={handlePopoverClose}
                                        anchorOrigin={{
                                            vertical: 'bottom',
                                            horizontal: 'center',
                                        }}
                                        transformOrigin={{
                                            vertical: 'top',
                                            horizontal: 'center',
                                        }}
                                        PaperProps={{
                                            sx: {
                                                boxShadow: 'none',
                                                bgcolor: 'transparent',
                                            },
                                        }}
                                    >
                                        <MuiAlert
                                            elevation={6}
                                            variant="filled"
                                            onClose={handleAlertClose}
                                            severity="success"
                                            sx={{ width: 'auto', bgcolor: '#2C2F7E', mt: 1 }}
                                        >
                                            {t`URL이 복사되었습니다!`}
                                        </MuiAlert>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {body.trim() && (
                            <div className="flex-grow">
                                <main className="max-w-[549px] w-full mx-auto pb-10 px-[34px] sm:px-0">
                                    <div className="pt-6 md:pt-[30px]">
                                        {/* BlockNote 정적 문서 렌더링 */}
                                        <div className="w-full blockNoteContainer">
                                            <BlockNoteEditor
                                                body={body}
                                                onLog={(message: string, data?: any) =>
                                                    publishLogger(message, data)
                                                }
                                            />
                                        </div>
                                    </div>
                                </main>
                            </div>
                        )}
                    </div>

                    {/* 푸터 - mt-auto로 하단에 배치 */}
                    <footer className="w-full bg-[#2C2F7E] text-white h-28 md:h-40 mt-auto px-[34px]">
                        <div className="max-w-[549px] w-full mx-auto flex justify-between items-center h-full py-4">
                            <div className="flex items-center gap-2">
                                {profileImgUrl && (
                                    <div className="w-[50px] h-[50px] rounded-full overflow-hidden">
                                        <img
                                            src={profileImgUrl}
                                            alt={t`프로필 이미지`}
                                            width={50}
                                            height={50}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                )}
                                <div>
                                    {nickname && (
                                        <div className="ml-1 font-bold text-lg font-light">
                                            {nickname}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="relative">
                                <a
                                    href="/welcome"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="opacity-50 hover:opacity-100"
                                >
                                    <svg
                                        width="29.65"
                                        height="16.94"
                                        className="fill-white md:w-[39.81px] md:h-[22.02px]"
                                        viewBox="0 0 57 28"
                                        xmlns="http://www.w3.org/2000/svg"
                                        preserveAspectRatio="xMidYMid meet"
                                    >
                                        <g clipPath="url(#prefix__clip0_795_28)">
                                            <path d="M22.72 4.91h3.416v20.76c0 1.24 1.04 2.247 2.32 2.247 1.279 0 2.318-1.007 2.318-2.246V4.909h3.415c1.315 0 2.38-1.03 2.38-2.304 0-1.273-1.065-2.304-2.38-2.304H22.724c-1.315 0-2.38 1.03-2.38 2.304 0 1.273 1.065 2.304 2.38 2.304h-.003zM8.122.3C3.652.3.012 3.919.012 8.365V19.85c0 4.445 3.64 8.063 8.11 8.063 4.47 0 8.11-3.618 8.11-8.063V8.364C16.237 3.918 12.597.3 8.123.3zm3.479 19.55c0 1.906-1.559 3.455-3.476 3.455-1.916 0-3.475-1.549-3.475-3.454V8.364c0-1.906 1.559-3.455 3.475-3.455 1.917 0 3.476 1.55 3.476 3.455V19.85zM52.276 19.85c0 1.906-1.559 3.455-3.475 3.455-1.917 0-3.476-1.549-3.476-3.454V2.547c0-1.24-1.039-2.246-2.319-2.246s-2.319 1.006-2.319 2.246v17.307c0 4.445 3.64 8.063 8.11 8.063 4.47 0 8.11-3.618 8.11-8.063V2.547C56.908 1.307 55.87.3 54.59.3s-2.32 1.006-2.32 2.246v17.307l.007-.003z"></path>
                                        </g>
                                        <defs>
                                            <clipPath id="prefix__clip0_795_28">
                                                <path
                                                    transform="translate(.012 .3)"
                                                    d="M0 0h56.899v27.613H0z"
                                                ></path>
                                            </clipPath>
                                        </defs>
                                    </svg>
                                </a>
                            </div>
                        </div>
                    </footer>
                </div>
            </ThemeProvider>
        </StyledEngineProvider>
    );
}
