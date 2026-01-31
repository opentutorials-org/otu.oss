import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { currentPageState, runSyncState, isModifiedState } from '@/lib/jotai';
import { useSetAtom } from 'jotai';
import { useState } from 'react';
import { useCreate } from '../home/logined/page/CreateUpdate/useCreate';
import { ulid } from 'ulid';
import { useNavigate } from 'react-router-dom';
import { chatLogger } from '@/debug/chat';
import { fetchTitling } from '@/functions/ai';
import { SavePageIcon } from '@/public/icon/SavePage';
import { useTranslations } from 'next-intl';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// HTML 태그를 제거하는 함수
function removeHtmlTags(text: string): string {
    if (!text) return '';
    // HTML 태그 제거
    const withoutTags = text.replace(/<[^>]*>?/gm, '');
    // HTML 엔티티 변환
    return withoutTags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

// 마크다운을 HTML로 변환하는 함수
export function convertMarkdownToHtml(markdown: string): string {
    if (!markdown) return '';

    // 이미 HTML인지 확인 (HTML 태그가 있는지 체크)
    const isAlreadyHTML = /<[a-z][\s\S]*>/i.test(markdown);

    if (isAlreadyHTML) {
        // 이미 HTML이면 DOMPurify로만 정화해서 반환
        const sanitizedHtml = DOMPurify.sanitize(markdown);

        // BlockNote가 <pre><code> 내부의 줄바꿈을 올바르게 처리하도록 변환
        const processedHtml = sanitizedHtml.replace(
            /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,
            (match, attrs, code) => {
                const lines = code.split('\n');
                // 코드 블록이 개행으로 끝나는 경우 split 결과 마지막에 빈 문자열이 들어가 불필요한 <br>이 추가되는 것을 방지
                if (lines.length > 0 && lines[lines.length - 1] === '') {
                    lines.pop();
                }
                // 줄바꿈을 <br>로 변환하고, 연속된 공백을 &nbsp;로 변환
                const preservedCode = lines
                    .map((line: string) => {
                        // 각 줄의 앞쪽 공백(들여쓰기)을 &nbsp;로 변환
                        const leadingSpaces = line.match(/^(\s+)/);
                        if (leadingSpaces) {
                            const spaces = leadingSpaces[1]
                                .replace(/ /g, '&nbsp;')
                                .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
                            return spaces + line.trimStart();
                        }
                        return line;
                    })
                    .join('<br>');
                return `<pre><code${attrs}>${preservedCode}</code></pre>`;
            }
        );

        chatLogger('convertMarkdownToHtml: 이미 HTML - sanitize 및 코드블록 보호 완료', {
            originalLength: markdown.length,
            sanitizedLength: sanitizedHtml.length,
            processedLength: processedHtml.length,
            codeBlockCount: (processedHtml.match(/<pre>/g) || []).length,
            brTagCount: (processedHtml.match(/<br>/g) || []).length,
        });

        return processedHtml;
    }

    // 마크다운인 경우에만 marked로 변환
    const markedOptions = {
        gfm: true,
        breaks: true,
        pedantic: false,
        sanitize: false,
        smartLists: true,
        smartypants: true,
    };

    // marked로 마크다운을 HTML로 변환하고 DOMPurify로 안전하게 정화
    const rawHtml = marked(markdown, markedOptions) as string;
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);

    // BlockNote가 <pre><code> 내부의 줄바꿈을 올바르게 처리하도록 변환
    const processedHtml = sanitizedHtml.replace(
        /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,
        (match, attrs, code) => {
            const lines = code.split('\n');
            // 코드 블록이 개행으로 끝나는 경우 split 결과 마지막에 빈 문자열이 들어가 불필요한 <br>이 추가되는 것을 방지
            if (lines.length > 0 && lines[lines.length - 1] === '') {
                lines.pop();
            }
            // 줄바꿈을 <br>로 변환하고, 연속된 공백을 &nbsp;로 변환
            const preservedCode = lines
                .map((line: string) => {
                    // 각 줄의 앞쪽 공백(들여쓰기)을 &nbsp;로 변환
                    const leadingSpaces = line.match(/^(\s+)/);
                    if (leadingSpaces) {
                        const spaces = leadingSpaces[1]
                            .replace(/ /g, '&nbsp;')
                            .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
                        return spaces + line.trimStart();
                    }
                    return line;
                })
                .join('<br>');
            return `<pre><code${attrs}>${preservedCode}</code></pre>`;
        }
    );

    chatLogger('convertMarkdownToHtml: 마크다운 변환 완료', {
        markdownLength: markdown.length,
        htmlLength: processedHtml.length,
        codeBlockCount: (processedHtml.match(/<pre>/g) || []).length,
    });

    return processedHtml;
}

// 텍스트에서 임시 제목 생성 함수
function generateInitialTitle(content: string): string {
    if (!content) return new Date().toISOString();

    const text = removeHtmlTags(content);

    // 줄바꿈이나, 문장 종결 부호(.!?)를 기준으로 첫 부분 추출
    const firstByNewline = text.split('\n')[0].trim();
    const firstBySentence = text.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || '';

    // 둘 중 더 짧은 것을 선택
    let firstParagraph =
        firstByNewline.length <= firstBySentence.length ? firstByNewline : firstBySentence;

    if (firstParagraph) {
        return firstParagraph.length > 50
            ? firstParagraph.substring(0, 50) + '...'
            : firstParagraph;
    }

    return new Date().toISOString();
}

export function CreatePageBtn({ content }: { content: string | null }) {
    const t = useTranslations('chat');
    const [copied, setCopied] = useState(false);
    const { editSubmitHandler } = useCreate();
    const setCurrentPage = useSetAtom(currentPageState);
    const setIsModified = useSetAtom(isModifiedState);
    const navigate = useNavigate();
    const runSync = useSetAtom(runSyncState);

    const handleClick = async () => {
        chatLogger('CreatePageBtn: handleClick:start');
        if (!content) return false;

        // 마크다운을 HTML로 변환
        const processedContent = convertMarkdownToHtml(content);

        // 초기 타이틀 생성
        const initialTitle = generateInitialTitle(content);

        const id = ulid();
        const createResult = await editSubmitHandler(
            initialTitle,
            processedContent,
            false,
            id,
            'text'
        );
        setIsModified(false); // 페이지 저장 후 수정 상태 초기화
        setCurrentPage({ type: 'PAGE_READ', id: id, path: '/home/page/' + id });
        navigate(`/page/${id}`);
        runSync({});
        chatLogger('CreatePageBtn: handleClick:done', { id });
    };

    return (
        <Tooltip title={t('copy-to-page')}>
            <IconButton onClick={handleClick} className="scale-[0.7]">
                {copied ? (
                    <CircularProgress size={18} thickness={8}></CircularProgress>
                ) : (
                    <SavePageIcon />
                )}
            </IconButton>
        </Tooltip>
    );
}
