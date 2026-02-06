import {
    chatSessionState,
    chatScrollToBottomState,
    MessageType,
    chatMessagesState,
} from '@/lib/jotai';
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
const copy = require('clipboard-copy');
const { convert } = require('html-to-text');
import './style.css';
import CopyAfterIcon from '@/public/icon/copyAfterIcon';
import CopyBeforeIcon from '@/public/icon/copyBeforeIcon';
import { useLingui } from '@lingui/react/macro';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { CreatePageBtn } from '@/components/Chat/CreatePageBtn';

export function Conversation({ onLeaveBottom }: { onLeaveBottom: (isLeave: boolean) => void }) {
    const { t } = useLingui();
    const chatSession = useAtomValue(chatSessionState);
    const chatMessages = useAtomValue(chatMessagesState);
    const chatScrollToBottom = useAtomValue(chatScrollToBottomState);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollBottomObserverRef = useRef<HTMLDivElement>(null);
    // const [showScrollButton, setShowScrollButton] = useState(false);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // 교차 영역에 들어온 경우
                    // setShowScrollButton(false);
                    onLeaveBottom(false);
                } else {
                    // 교차 영역에서 벗어난 경우
                    // setShowScrollButton(true);
                    onLeaveBottom(true);
                }
            });
        });
        const element = scrollBottomObserverRef.current as Element;
        if (element) {
            observer.observe(element);
        }
        return () => {
            if (element) {
                observer.unobserve(element);
            }
        };
    }, []);

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: chatScrollToBottom > 0 ? 'smooth' : 'auto',
            });
        }
    }, [chatScrollToBottom]);
    useEffect(() => {
        const _noticeText = t`#을 누르면 검색 결과에 대해서 질문할 수 있습니다.` + '<br />';
        setNotice(_noticeText);
    }, [t]);

    return (
        <>
            <div
                id="chat_conversation_root"
                className={`px-[17px] overflow-y-auto flex-1 pt-8 mt-4`}
                ref={scrollContainerRef}
            >
                {chatMessages.map((item) => {
                    if (item.type === MessageType.Request) {
                        return (
                            <RequestMessage key={item.id} id={item.id} name={item.name}>
                                {item.content}
                            </RequestMessage>
                        );
                    } else if (item.type === MessageType.SimilarityResponseStart) {
                        return (
                            <SimilarityStartMessage key={item.id} id={item.id} name={item.name}>
                                {item.content}
                            </SimilarityStartMessage>
                        );
                    } else if (item.type === MessageType.SimilarityResponseEnd) {
                        return (
                            <SimilarityEndMessage
                                key={item.id}
                                id={item.id}
                                name={item.name}
                                data={item.content}
                            ></SimilarityEndMessage>
                        );
                    } else if (item.type === MessageType.SimilarityResponseEndNotFound) {
                        return (
                            <SimilarityEndMessageNotFound
                                key={item.id}
                                id={item.id}
                                name={item.name}
                                data={item.content}
                            ></SimilarityEndMessageNotFound>
                        );
                    } else if (item.type === MessageType.LLMResponse) {
                        return (
                            <LLMResponseMessage key={item.id} id={item.id} name={item.name}>
                                {item.content}
                            </LLMResponseMessage>
                        );
                    }
                })}
                <div ref={scrollBottomObserverRef} className="scroll-bottom-observer h-1"></div>
            </div>
        </>
    );
}

function Root({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <div className={`rounded-lg`} id={`history_item_${id}`}>
            <div className={`border-b-[#d7d7d7] dark:border-b-[#383838] border-b-[1px] py-[20px]`}>
                {children}
            </div>
        </div>
    );
}
function Name({
    name,
    justifyContent = 'start',
}: {
    name: string;
    justifyContent?: 'start' | 'end';
}) {
    return (
        <div className="gap-1 mb-2" style={{ display: 'flex', justifyContent }}>
            <div
                className={`rounded-2xl p-1 py-[2px] w-fit min-w-[24px] text-[8px] font-semibold border-black flex justify-center items-center bg-text-color inverted-text-color`}
            >
                {name}
            </div>
        </div>
    );
}
function NoticeMessage({ id, name, children }: { id: string; name: string; children: string }) {
    return (
        <Root id={id}>
            <Name name={name}></Name>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(children) }}></div>
        </Root>
    );
}
function RequestMessage({
    id,
    name,
    children,
}: {
    id: string;
    name: string;
    children: string | null;
}) {
    return (
        <Root id={id}>
            <div
                id="ai_request_comment"
                className="bg-color px-3 py-2 rounded-lg relative right-0 max-w-[80%] ml-auto w-fit"
            >
                {children}
            </div>
        </Root>
    );
}
function SimilarityStartMessage({
    id,
    name,
    children,
}: {
    id: string;
    name: string;
    children: string | null;
}) {
    return (
        <Root id={id}>
            <Name name={name} justifyContent="start"></Name>
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(children ?? '') }}></div>
        </Root>
    );
}
function SimilarityEndMessage({ id, name, data }: { id: string; name: string; data: any[] }) {
    const { t } = useLingui();
    return (
        <Root id={id}>
            <Name name={name} justifyContent="start"></Name>
            {t`찾았습니다!`}
            <div>
                {data.map((item, index) => {
                    return (
                        <ReferenceItem
                            key={index}
                            href={`/home/page/${item.page_id}`}
                            title={item.metadata.title}
                            content={item.content}
                        ></ReferenceItem>
                    );
                })}
            </div>
        </Root>
    );
}
function SimilarityEndMessageNotFound({
    id,
    name,
    data,
}: {
    id: string;
    name: string;
    data: string;
}) {
    return (
        <Root id={id}>
            <Name name={name} justifyContent="start" />
            <div>{data}</div>
        </Root>
    );
}
function LLMResponseMessage({
    id,
    name,
    children,
}: {
    id: string;
    name: string;
    children: string | null;
}) {
    // marked 옵션 설정 (필요에 따라 조정)
    const markedOptions = {
        gfm: true, // GitHub Flavored Markdown 활성화
        breaks: true, // 줄바꿈을 <br>로 변환
        pedantic: false,
        sanitize: false, // DOMPurify를 사용할 것이므로 marked의 sanitize는 비활성화
        smartLists: true,
        smartypants: true,
    };

    // 마크다운 변환 함수
    const renderMarkdown = (content: string) => {
        if (!content) return '';
        // marked로 마크다운을 HTML로 변환하고 DOMPurify로 안전하게 정화
        const rawHtml = marked(content, markedOptions) as string;
        return DOMPurify.sanitize(rawHtml);
    };

    return (
        <Root id={id}>
            <Name name={name} justifyContent="start"></Name>
            <div
                className="markdown-content"
                dangerouslySetInnerHTML={{
                    __html: children ? renderMarkdown(children) : '',
                }}
            />
            <div className="flex items-center justify-end relative right-[-7px]">
                <CreatePageBtn content={children}></CreatePageBtn>
                <CopyBtn content={children}></CopyBtn>
            </div>
        </Root>
    );
}

function CopyBtn({ content }: { content: string | null }) {
    const { t } = useLingui();
    const [copied, setCopied] = useState(false);

    const handleClick = () => {
        copy(convert(content));
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 3000);
    };
    const icon = !copied ? <CopyBeforeIcon></CopyBeforeIcon> : <CopyAfterIcon></CopyAfterIcon>;
    return (
        <Tooltip title={t`채팅 내용을 클립보드로 복사`}>
            <IconButton onClick={handleClick} className="scale-75 -ml-[10px] text-color">
                {icon}
            </IconButton>
        </Tooltip>
    );
}

function ReferenceItem({ title, href, content }: { title: string; href: string; content: string }) {
    const { t } = useLingui();
    const textLengthLimit = 40;
    const [showFullText, setShowFullText] = useState(false);
    const _content = convert(content);

    const handleClick = () => {
        setShowFullText(!showFullText);
    };

    return (
        <div className="bg-color p-2 my-2 rounded-md">
            {true ? (
                <div>
                    <div className="mb-[13px]">{title}</div>
                    {_content}{' '}
                    <Link
                        href={`${href}`}
                        className="ml-2 text-[11px] border-b-[1px] border-color "
                    >
                        <Image
                            src="/icon/hereicons-link.svg"
                            width="12"
                            height="12"
                            className="dark:invert inline mb-[2px]"
                            alt="link"
                        ></Image>
                        {t`본문열기`}
                    </Link>
                </div>
            ) : (
                <div onClick={handleClick} className="cursor-pointer">
                    {_content.length > textLengthLimit ? (
                        <div>
                            {_content.slice(0, textLengthLimit)}
                            <Image
                                src="/icon/heroicons-more.svg"
                                width="20"
                                height="20"
                                alt="more"
                                className="dark:invert inline"
                            ></Image>
                        </div>
                    ) : (
                        _content
                    )}
                </div>
            )}
        </div>
    );
}
