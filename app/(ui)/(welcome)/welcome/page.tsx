'use client';
import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import Logo from '@/public/icon/logo';
import Android from '@mui/icons-material/Android';
import Apple from '@mui/icons-material/Apple';
import Microsoft from '@mui/icons-material/Microsoft';
import Terminal from '@mui/icons-material/Terminal';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Btn } from '@/components/layout/Btn';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isReactNativeWebView } from '@/functions/detectEnvironment';
import { openExternalLink } from '@/utils/openExternalLink';
import { GlobeAmericasIcon } from '@heroicons/react/24/solid';

const APP_URL = process.env.NEXT_PUBLIC_HOST || 'https://otu.ai';

// const Slogan = lazy(() => import('@/public/etc/slogan'));

// Page 컴포넌트: 페이지의 주요 구조를 정의합니다.
export default function Page() {
    const router = useRouter();
    useEffect(() => {
        router.prefetch('/signin');
    }, []);
    return (
        <>
            <Top />
            <Content />
        </>
    );
}

// Top 컴포넌트: 상단 섹션을 정의합니다.
function Top() {
    const t = useTranslations();
    const [isWebView, setIsWebView] = useState<boolean | null>(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsWebView(isReactNativeWebView());
        }
    }, []);

    const btnStyle = {
        maxWidth: '348px',
        width: '100%',
        borderRadius: '3px',
    };
    return (
        <div>
            <div className="text-center  mt-[73px] ">
                <div className="flex flex-col items-center gap-[11px]">
                    <Link
                        href="/signin"
                        style={btnStyle}
                        className="inline-flex justify-center items-center h-[48px] bg-text-color inverted-text-color text-[17px] font-bold click-animation"
                        prefetch={true}
                    >
                        {t('home.register')}
                    </Link>
                    <Link
                        href="/signin"
                        className="inline-flex justify-center items-center h-[48px] bg-text-color inverted-text-color text-[17px] font-bold click-animation"
                        style={btnStyle}
                        prefetch={true}
                    >
                        {t('home.signin')}
                    </Link>
                </div>
            </div>

            <div className="mt-[35px]">
                <div className="flex flex-col items-center gap-[11px]">
                    {!isWebView && (
                        <>
                            <Btn
                                onClick={() => {
                                    openExternalLink(
                                        'https://apps.apple.com/kr/app/otu-ai/id6473810282'
                                    );
                                }}
                            >
                                <Apple className="w-[20px]" />
                                App Store
                            </Btn>
                            <Btn
                                onClick={() => {
                                    openExternalLink(
                                        'https://play.google.com/store/apps/details?id=ai.otu.android'
                                    );
                                }}
                            >
                                <Android className="w-[20px] mr-1" />
                                Google Play
                            </Btn>
                        </>
                    )}

                    <Btn
                        onClick={() => {
                            openExternalLink(`${APP_URL}/welcome`);
                        }}
                    >
                        <GlobeAmericasIcon className="w-[20px] mr-1" />
                        Web browser
                    </Btn>

                    {/* <Btn
                        onClick={() => {
                            alert(t('home.coming-soon'));
                        }}
                    >
                        <Terminal className="mr-1 w-[20px]" />
                        CLI
                    </Btn> */}

                    <Btn
                        onClick={() => {
                            openExternalLink(
                                'https://marketplace.visualstudio.com/items?itemName=opentutorials.otu-ai'
                            );
                        }}
                    >
                        Visual Studio Code & Cursor Extension
                    </Btn>
                </div>
            </div>

            <div className="flex justify-center mt-[90px]">
                {/* <Slogan className="fill-text-color" width="200"></Slogan> */}
                <p className="text-text-color font-medium text-[14px] tracking-wide">
                    {t('home.about-otu.slogan')}
                </p>
            </div>
        </div>
    );
}

// Content 컴포넌트: 콘텐츠 섹션을 정의합니다.
function Content() {
    const t = useTranslations();
    const accordionStyle = {
        boxShadow: 'none',
        margin: 0,
        borderBottom: '1px solid var(--border-color)',
        '&:before': {
            display: 'none',
        },
        '&.Mui-expanded': {
            margin: 0,
            borderBottom: '1px solid var(--border-color)',
        },
        '&:last-of-type': {
            borderBottom: 'none',
        },
    };
    const iconStyle = { fontSize: '1.2rem', opacity: 0.5 };
    return (
        <>
            <div className="mt-[94px] ">
                <Accordion sx={accordionStyle}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={iconStyle} />}>
                        <div className="text-[19px] text-color">{t('home.features.title')}</div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t('home.features.cross-platform.title')}
                            </span>
                            <div className="ml-2">{t('home.features.cross-platform.desc')}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t('home.features.ai-chatbot.title')}
                            </span>
                            <div className="ml-2">{t('home.features.ai-chatbot.desc')}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t('home.features.editing.title')}
                            </span>
                            <div className="ml-2">{t('home.features.editing.desc')}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t('home.features.quick-note.title')}
                            </span>
                            <div className="ml-2">{t('home.features.quick-note.desc')}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t('home.features.auto-title.title')}
                            </span>
                            <div className="ml-2">{t('home.features.auto-title.desc')}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t('home.features.ocr.title')}
                            </span>
                            <div className="ml-2">{t('home.features.ocr.desc')}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t('home.features.fast-loading.title')}
                            </span>
                            <div className="ml-2">{t('home.features.fast-loading.desc')}</div>
                        </Pa>
                    </AccordionDetails>
                </Accordion>
                <Accordion sx={accordionStyle}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={iconStyle} />}>
                        <div className="text-[19px] text-color">{t('home.about-otu.title')}</div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Pa>
                            {t('home.about-otu.desc-1')}
                            {t('home.about-otu.desc-2')}
                            {t.rich('home.about-otu.desc-3', {
                                helpLink: (chunks) => (
                                    <a
                                        className="underline"
                                        href="https://github.com/opentutorials-org/otu.ai/issues"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {chunks}
                                    </a>
                                ),
                                newline: () => <br />,
                            })}
                        </Pa>
                    </AccordionDetails>
                </Accordion>
                <Accordion sx={accordionStyle}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={iconStyle} />}>
                        <div className="text-[19px] text-color">
                            {t('home.about-opentutorials.title')}
                        </div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Pa>{t('home.about-opentutorials.desc-1')}</Pa>
                        <Pa>{t('home.about-opentutorials.desc-2')}</Pa>
                        <Pa>
                            {t.rich('home.about-opentutorials.desc-3', {
                                openTutorialsLink: (chunks) => (
                                    <a className="underline" href="https://opentutorials.org">
                                        {chunks}
                                    </a>
                                ),
                                otuLink: (chunks) => (
                                    <a className="underline" href={APP_URL}>
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </Pa>
                        <Pa>{t('home.about-opentutorials.desc-4')}</Pa>
                    </AccordionDetails>
                </Accordion>
            </div>
            <div className="mt-[120px] text-center text-[15px]">
                {t.rich('home.footer.slogan', {
                    br: () => <br />,
                })}
            </div>
        </>
    );
}

// Pa 컴포넌트: 텍스트 단락을 정의합니다.
function Pa({ children }: { children: React.ReactNode }) {
    return <div className="pt-0 py-3 text-[15px] opacity-70 text-color">{children}</div>;
}
