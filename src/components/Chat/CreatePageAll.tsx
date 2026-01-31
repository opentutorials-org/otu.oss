import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import {
    chatMessagesState,
    currentPageState,
    runSyncState,
    MessageType,
    openSnackbarState,
} from '@/lib/jotai';
import { useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';
import { useCreate } from '../home/logined/page/CreateUpdate/useCreate';
import { ulid } from 'ulid';
import { fetchTitling } from '@/functions/ai';
import { SavePageIcon } from '@/public/icon/SavePage';
import { useTranslations } from 'next-intl';
import { convertMarkdownToHtml } from './CreatePageBtn';
import Tooltip from '@mui/material/Tooltip';
import { useNavigate } from 'react-router-dom';
import { chatLogger } from '@/debug/chat';

export function CreatePageAll() {
    const t = useTranslations('chat');
    const [copied, setCopied] = useState(false);
    const { editSubmitHandler } = useCreate();
    const chatMessages = useAtomValue(chatMessagesState);
    const runSync = useSetAtom(runSyncState);
    const setCurrentPage = useSetAtom(currentPageState);
    const navigate = useNavigate();
    const openSnackbar = useSetAtom(openSnackbarState);

    const handleClick = async () => {
        chatLogger('CreatePageAll: handleClick:start');
        if (chatMessages.length === 0) return false;
        setCopied(true);

        // 이미지와 같은 형식으로 채팅 내용 변환
        const formatMessages = () => {
            const paragraphs = [];

            for (const message of chatMessages) {
                const content = message.content;
                // 마크다운인 경우 HTML로 변환
                const processedContent = convertMarkdownToHtml(content);

                // p 태그로 시작하는지 확인
                const startsWithPTag =
                    processedContent.trim().startsWith('<p>') &&
                    processedContent.trim().endsWith('</p>');

                if (message.type === MessageType.Request) {
                    // 사용자 메시지
                    if (startsWithPTag) {
                        // 이미 p 태그가 있는 경우 태그 내부에 이모지 추가
                        paragraphs.push(processedContent.replace('<p>', '<p>💬 '));
                    } else {
                        // 일반 텍스트인 경우, p 태그로 감싸기
                        paragraphs.push(`<p>💬 ${processedContent}</p>`);
                    }
                } else if (message.type === MessageType.LLMResponse) {
                    // AI 응답
                    if (startsWithPTag) {
                        // 이미 p 태그가 있는 경우 태그 내부에 이모지 추가
                        paragraphs.push(
                            processedContent.replace('<p>', '<p>💡 ') + '<p>&nbsp;</p>'
                        );
                    } else {
                        // 일반 텍스트인 경우, p 태그로 감싸기
                        paragraphs.push(`<p>💡 ${processedContent}</p><p>&nbsp;</p>`);
                    }
                }
            }

            // 최종 HTML 반환
            return paragraphs.join('\n');
        };

        const content = formatMessages();
        const id = ulid();

        // 첫 번째 답변(type=LLMResponse)을 찾아 첫 소절을 임시 제목으로 사용
        let initialTitle = new Date().toISOString(); // 기본값으로 현재 시간
        const assistantMessage = chatMessages.find(
            (message) => message.type === MessageType.LLMResponse
        );

        if (assistantMessage && assistantMessage.content) {
            // AI 메시지로부터 제목 생성
            const processedContent = convertMarkdownToHtml(assistantMessage.content);

            try {
                // 타이틀 생성 API 호출 (fetchTitling 대신 텍스트 기반 생성 사용)
                const assistantText = assistantMessage.content;

                // 첫 문장 또는 첫 줄을 추출
                const text = assistantText.replace(/<[^>]*>?/gm, '');

                // 줄바꿈이나 문장 종결 부호(.!?)를 기준으로 첫 부분 추출
                const firstByNewline = text.split('\n')[0].trim();
                const firstBySentence = text.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || '';

                // 둘 중 더 짧은 것을 선택
                let firstParagraph =
                    firstByNewline.length <= firstBySentence.length
                        ? firstByNewline
                        : firstBySentence;

                if (firstParagraph) {
                    initialTitle =
                        firstParagraph.length > 50
                            ? firstParagraph.substring(0, 50) + '...'
                            : firstParagraph;
                }
            } catch (error) {
                console.error('Title generation error:', error);
            }
        }

        const createResult = await editSubmitHandler(initialTitle, content, false, id, 'text');

        // API를 통한 타이틀 생성 및 업데이트 (navigate 전에 실행)
        try {
            const title = await fetchTitling(id, content);
            await editSubmitHandler(title.data.createdTitle, content, false, id, 'text');
        } catch (error: any) {
            console.error('Title API error:', error);
        }

        // 제목 생성 완료 후 페이지 이동
        setCurrentPage({ type: 'PAGE_READ', id: id, path: '/home/page/' + id });
        setTimeout(() => {
            navigate(`/page/${id}`);
        }, 100);

        setCopied(false);
        chatLogger('CreatePageAll: handleClick:done', { id });
    };

    const icon = copied ? (
        <CircularProgress size={16} thickness={3}></CircularProgress>
    ) : (
        <SavePageIcon fontSize="inherit" style={{ fontSize: '1.1rem' }} />
    );

    return (
        <Tooltip title={t('save-all-chat')}>
            <span>
                <Button
                    startIcon={icon}
                    onClick={handleClick}
                    sx={{
                        fontSize: '0.7rem',
                        '& .MuiButton-startIcon': {
                            marginRight: 0.4,
                        },
                    }}
                    disabled={copied || chatMessages.length === 0}
                >
                    {t('save-page')}
                </Button>
            </span>
        </Tooltip>
    );
}
