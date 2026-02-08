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
import { useLingui, Trans } from '@lingui/react/macro';
import { isReactNativeWebView } from '@/functions/env/detectEnvironment';
import { openExternalLink } from '@/utils/openExternalLink';
import { GlobeAmericasIcon } from '@heroicons/react/24/solid';

function getAppUrl() {
    return typeof window !== 'undefined' ? window.location.origin : 'https://otu.ai';
}

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
    const { t } = useLingui();
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
                        {t`회원가입`}
                    </Link>
                    <Link
                        href="/signin"
                        className="inline-flex justify-center items-center h-[48px] bg-text-color inverted-text-color text-[17px] font-bold click-animation"
                        style={btnStyle}
                        prefetch={true}
                    >
                        {t`로그인`}
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
                            openExternalLink(`${getAppUrl()}/welcome`);
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
                    {t`기록에서 기억까지`}
                </p>
            </div>
        </div>
    );
}

// Content 컴포넌트: 콘텐츠 섹션을 정의합니다.
function Content() {
    const { t } = useLingui();
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
                        <div className="text-[19px] text-color">{t`기능`}</div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Pa>
                            <span className="text-[15px] font-bold">
                                · {t`크로스 플랫폼 메모장`}
                            </span>
                            <div className="ml-2">{t`다양한 기기에서 동일한 경험을 제공합니다.`}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">· {t`AI 챗봇`}</span>
                            <div className="ml-2">{t`내 기록을 바탕으로 AI가 답변해줍니다.`}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">· {t`강력한 편의 기능`}</span>
                            <div className="ml-2">{t`워드프로세서 수준의 고급 편집 기능을 지원합니다.`}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">· {t`빠른 기록`}</span>
                            <div className="ml-2">{t`순간적으로 메모하고 바로 일상으로 돌아가세요.`}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">· {t`자동 제목 생성`}</span>
                            <div className="ml-2">{t`제목 고민은 이제 그만, 자동으로 생성해 드립니다.`}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">· {t`OCR`}</span>
                            <div className="ml-2">{t`이미지의 텍스트를 추출하여 메모로 저장합니다.`}</div>
                        </Pa>
                        <Pa>
                            <span className="text-[15px] font-bold">· {t`빠른 로딩`}</span>
                            <div className="ml-2">{t`클릭과 동시에 즉시 메모가 열립니다.`}</div>
                        </Pa>
                    </AccordionDetails>
                </Accordion>
                <Accordion sx={accordionStyle}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={iconStyle} />}>
                        <div className="text-[19px] text-color">{t`OTU 소개`}</div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Pa>
                            {t`OTU는 메모장입니다.`}
                            {t`거기에 AI를 보탰습니다.`}
                            <Trans>
                                더 쉽게 넣고, 더 유용하게 꺼낼 수 있습니다.
                                <br />
                                <a
                                    className="underline"
                                    href="https://github.com/opentutorials-org/otu.ai/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    도움말 보기
                                </a>
                            </Trans>
                        </Pa>
                    </AccordionDetails>
                </Accordion>
                <Accordion sx={accordionStyle}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={iconStyle} />}>
                        <div className="text-[19px] text-color">{t`오픈튜토리얼스 소개`}</div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Pa>{t`OTU는 오픈튜토리얼스에서 개발하고 운영하는 지식 공유 및 메모 서비스입니다.`}</Pa>
                        <Pa>{t`오픈튜토리얼스는 2016년 4월 15일 한국에서 설립된 비영리 단체로, 기술을 활용하여 지식의 자유로운 공유를 촉진하고자 합니다. 우리의 목표는 "남이 할 수 있는 걸 나도 할 수 있게, 내가 할 수 있는 걸 남도 할 수 있게"라는 슬로건 아래, 서로 배움과 성장을 지원하는 것입니다.`}</Pa>
                        <Pa>
                            <Trans>
                                다양한 분야의 전문가들, 특히 소프트웨어 엔지니어들이 모여
                                오픈튜토리얼스의 서비스 개발과 운영을 이끌고 있으며, 주요 서비스로는
                                지식 공유 플랫폼{' '}
                                <a className="underline" href="https://opentutorials.org">
                                    opentutorials.org
                                </a>
                                와 메모 서비스{' '}
                                <a className="underline" href={getAppUrl()}>
                                    OTU
                                </a>{' '}
                                등이 있습니다.
                            </Trans>
                        </Pa>
                        <Pa>{t`오픈튜토리얼스는 비영리 단체로서 주주가 존재하지 않으며, 잉여 수익은 서비스 운영비를 제외하고 사용자와 사회를 위한 사업에 재투자됩니다. 이익을 위해 서비스와 사용자의 데이터를 매각하지 않을 것을 약속 합니다.`}</Pa>
                    </AccordionDetails>
                </Accordion>
            </div>
            <div className="mt-[120px] text-center text-[15px]">
                <Trans>
                    남이 할 수 있는 걸 나도 할 수 있게
                    <br />
                    내가 할 수 있는 걸 남도 할 수 있게
                </Trans>
            </div>
        </>
    );
}

// Pa 컴포넌트: 텍스트 단락을 정의합니다.
function Pa({ children }: { children: React.ReactNode }) {
    return <div className="pt-0 py-3 text-[15px] opacity-70 text-color">{children}</div>;
}
