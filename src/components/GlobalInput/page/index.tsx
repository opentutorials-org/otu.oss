import { useCreate } from '@/components/home2/editor/hooks/useCreate';
import {
    isDarkModeAtom,
    openSnackbarState,
    similarityResponse,
    currentPageState,
} from '@/lib/jotai';
import { useAtomValue, useSetAtom } from 'jotai';
import { useState, useEffect, useRef } from 'react';
import TextArea from '../TextArea';
import Wrapper from '../wrapper';
import { ulid } from 'ulid';
import { useLingui } from '@lingui/react/macro';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { editorIndexLogger } from '@/debug/editor';
import { createClient, fetchUserId } from '@/supabase/utils/client';
import { parseTitleAndBody } from './parseTitleAndBody';
import Plus from '@/public/icon/plus';
import dynamic from 'next/dynamic';
import { list } from '@/watermelondb/control/Page';
import { fetchCaption } from '@/functions/uploadcare';
import { isDevelopment } from '@/utils/environment';
import { editorOcrLogger } from '@/debug/editor';
import { useNavigation } from '@/hooks/useNavigation';
import { MAX_TEXT_LENGTH } from '@/functions/validation/textLength';
const Prepend = dynamic(() => import('@/public/icon/prepend'), { ssr: false });

export const SUGGEST_MINIMUM_LENGTH = 3;
export const SUGGEST_DISTANCE_THRESHOLD = 0.5;

const getSimilarity = async (
    message: string,
    page_id: string | null = null,
    signal?: AbortSignal
): Promise<similarityResponse[]> => {
    try {
        const response = await fetch('/api/ai/similaritySearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputMessage: message,
                page_id,
                count: 5,
            }),
            signal: signal,
        });
        const result = await response.json();
        return result.data;
    } catch (error) {
        // AbortError는 정상적인 취소로 간주
        if (error instanceof Error && error.name === 'AbortError') {
            editorIndexLogger('getSimilarity aborted');
            return [];
        }
        throw error;
    }
};

export default function QuickNoteInput() {
    const darkMode = useAtomValue(isDarkModeAtom);
    const { editSubmitHandler } = useCreate();
    const [title, setTitle] = useState('');
    const [hasOverflowed, setHasOverflowed] = useState(false);
    const [loading, setLoading] = useState<{
        [key: string]: { prepend: boolean; append: boolean };
    }>({});
    const darkPrefix = darkMode ? '/dark' : '';
    const { t } = useLingui();
    const [suggestions, setSuggestions] = useState<similarityResponse[]>([]);
    const textRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const { navigate, navigateToPageEdit } = useNavigation();
    const lastTriggerLengthRef = useRef<number>(SUGGEST_MINIMUM_LENGTH);
    const openSnackbar = useSetAtom(openSnackbarState);
    const setCurrentPage = useSetAtom(currentPageState);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [lastSubmitTime, setLastSubmitTime] = useState<number>(0);

    useEffect(() => {
        if (textAreaRef.current) {
            textAreaRef.current.focus();
        }

        return () => {
            // 컴포넌트 언마운트 시 진행 중인 요청 취소
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [textAreaRef.current]);

    const handleBlur = async () => {
        if (title.trim() === '') {
            setHasOverflowed(false);
            setSuggestions([]);
        }
    };

    // @ts-ignore
    const insertPageToSuggested = async (suggestion, prepend) => {
        setLoading((prev) => ({
            ...prev,
            [suggestion.page_id]: {
                ...prev[suggestion.page_id],
                [prepend ? 'prepend' : 'append']: true,
            },
        }));
        editorIndexLogger('suggestion clicked', suggestion);
        const supabase = createClient();
        const user_id = await fetchUserId();
        const { data, error } = await supabase
            .from('page')
            .select('*')
            .eq('user_id', user_id)
            .eq('id', suggestion.page_id)
            .single();
        if (error) {
            editorIndexLogger('error', error);
            setLoading((prev) => ({
                ...prev,
                [suggestion.page_id]: {
                    ...prev[suggestion.page_id],
                    [prepend ? 'prepend' : 'append']: false,
                },
            }));
            return;
        }
        const { title: _title, body: _body, is_public: _is_public, id: _id } = data;
        const newBody = prepend
            ? `<p class="inserted">${title}</p>${_body}`
            : `${_body}<p class="inserted">${title}</p>`;
        const result = await editSubmitHandler(
            _title,
            newBody,
            _is_public === null ? false : _is_public,
            _id,
            'text'
        );
        const url = '/page/' + suggestion.page_id;
        navigate(url);
        setCurrentPage({ type: 'PAGE_READ', id: suggestion.page_id, path: url });
        setHasOverflowed(false);
        setSuggestions([]);
        setTitle('');
        setLoading((prev) => ({
            ...prev,
            [suggestion.page_id]: {
                prepend: false,
                append: false,
            },
        }));
    };

    editorIndexLogger('Page rendering', { title, hasOverflowed, suggestions });
    const uniqueSuggestions = Array.from(
        suggestions
            .reduce((map, suggestion) => {
                if (!map.has(suggestion.page_id)) {
                    map.set(suggestion.page_id, suggestion);
                }
                return map;
            }, new Map())
            .values()
    );

    const handleTitleChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const currentLength = newValue.length;
        const newThreshold = lastTriggerLengthRef.current * 1.5;
        if (currentLength >= newThreshold) {
            editorIndexLogger('자동 검색 임계점을 넘었다', {
                newValue,
                hasOverflowed,
                SUGGEST_LENGTH_THRESHOLD: SUGGEST_MINIMUM_LENGTH,
            });
            setHasOverflowed(true);

            // 이전 요청이 있으면 취소
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // 새 AbortController 생성
            abortControllerRef.current = new AbortController();

            getSimilarity(newValue, null, abortControllerRef.current.signal)
                .then((similarityResult) => {
                    if (similarityResult && document?.activeElement?.id === 'quick_input') {
                        editorIndexLogger('similarityResult', similarityResult);
                        setSuggestions(similarityResult);
                    }
                })
                .catch((error) => {
                    // AbortError는 무시
                    if (error instanceof Error && error.name !== 'AbortError') {
                        console.error('Similarity search error:', error);
                    }
                });
            lastTriggerLengthRef.current = newThreshold;
        }

        if (currentLength === 0) {
            editorIndexLogger('입력값이 0이 되었다 => suggestions 초기화');
            setSuggestions([]);
            setHasOverflowed(false);
            lastTriggerLengthRef.current = SUGGEST_MINIMUM_LENGTH;
        }

        setTitle(newValue);
    };

    return (
        <div>
            <Wrapper>
                <div className={`${title.length > 0 && 'hidden'}`}>
                    <Plus width="16" className="fill-text-color" />
                </div>
                <TextArea
                    ref={textAreaRef}
                    mode="page"
                    value={title}
                    onChange={handleTitleChange}
                    maxLength={MAX_TEXT_LENGTH}
                    onDirectSubmit={async (content, pageId) => {
                        // 붙여넣기된 내용은 전체가 본문으로 처리
                        let bodyPart = content;
                        // 임시 제목 설정
                        let titlePart = t`제목 작성 중...`;

                        // 이미지가 포함되어 있는지 확인
                        const hasImage = content.includes('<img');
                        let imageUrl = '';

                        if (hasImage) {
                            // 이미지 URL 추출
                            const imgMatch = content.match(/<img src="([^"]+)"/);
                            if (imgMatch && imgMatch[1]) {
                                imageUrl = imgMatch[1];
                            }
                        }

                        // 페이지 생성
                        await editSubmitHandler(titlePart, bodyPart, false, pageId, 'text');
                        setTitle('');
                        setSuggestions([]);
                        setHasOverflowed(false);

                        // 페이지 생성 후 페이지 리스트로 이동
                        navigate('/page');

                        // 이미지가 있는 경우 캡션 생성
                        if (hasImage && imageUrl) {
                            try {
                                editorOcrLogger('이미지 캡션 생성 시작', { pageId, imageUrl });

                                // 이전 요청이 있으면 취소
                                if (abortControllerRef.current) {
                                    abortControllerRef.current.abort();
                                }

                                // 새 AbortController 생성
                                abortControllerRef.current = new AbortController();

                                const titleResult = await fetchCaption(
                                    pageId,
                                    imageUrl,
                                    abortControllerRef.current.signal
                                );
                                editorOcrLogger('fetchCaption 응답 받음', { titleResult });

                                if (titleResult && titleResult.result && titleResult.result.title) {
                                    // 생성된 제목으로 페이지 업데이트
                                    titlePart = titleResult.result.title;
                                    editorOcrLogger('제목 업데이트됨', { titlePart });

                                    // OCR 텍스트가 있으면 본문에 추가
                                    const ocr = titleResult.result.ocr || null;
                                    editorOcrLogger('OCR 텍스트 확인', {
                                        ocr,
                                        ocrLength: ocr?.length,
                                    });

                                    if (ocr && ocr.trim().length > 0) {
                                        bodyPart += `<p>${ocr}</p>`;
                                        editorOcrLogger('OCR 텍스트를 본문에 추가', {
                                            bodyPart,
                                            ocrText: ocr,
                                            finalBodyLength: bodyPart.length,
                                        });
                                    }

                                    editorOcrLogger('editSubmitHandler 호출 직전', {
                                        titlePart,
                                        bodyPart,
                                        pageId,
                                    });
                                    await editSubmitHandler(
                                        titlePart,
                                        bodyPart,
                                        false,
                                        pageId,
                                        'text'
                                    );
                                    editorOcrLogger('editSubmitHandler 완료');
                                }
                            } catch (error) {
                                // AbortError는 무시
                                if (error instanceof Error && error.name !== 'AbortError') {
                                    editorOcrLogger('제목 생성 오류', { error });
                                    console.error('제목 생성 오류:', error);
                                    openSnackbar({
                                        message: t`제목을 자동으로 생성할 수 없습니다. 제목을 입력해 주세요.`,
                                    });
                                }
                            }
                        } else {
                            // 이미지가 없는 경우 "제목 없음"으로 설정
                            await editSubmitHandler(t`제목 없음`, bodyPart, false, pageId, 'text');
                        }
                    }}
                    onEnter={async (evt) => {
                        let redirect = '/page';
                        // if shift + enter, insert a new line and do nothing
                        if (evt.shiftKey) {
                            evt.preventDefault();

                            if (textAreaRef.current) {
                                const textarea = textAreaRef.current;
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;

                                // Insert a new line at the cursor position
                                const newValue = title.slice(0, start) + '\n' + title.slice(end);
                                setTitle(newValue);

                                // Move the cursor to the position right after the new line
                                setTimeout(() => {
                                    textarea.selectionStart = textarea.selectionEnd = start + 1;
                                }, 0);
                            }
                            return;
                        }

                        // 개발 환경에서는 빠른 입력 제한을 적용하지 않음
                        if (!isDevelopment()) {
                            const now = Date.now();
                            const timeDiff = now - lastSubmitTime;

                            // 마지막 입력 후 10초 이내이면 입력 차단
                            if (lastSubmitTime > 0 && timeDiff < 10000) {
                                openSnackbar({
                                    message: t`너무 빠른 입력입니다. ${Math.ceil((10000 - timeDiff) / 1000)}초 후에 다시 시도해주세요.`,
                                });
                                return;
                            }

                            // 현재 시간을 마지막 입력 시간으로 저장
                            setLastSubmitTime(now);
                        }

                        let id = ulid();
                        let { title: titlePart, body: bodyPart } = parseTitleAndBody(title);

                        let updatedBody = bodyPart;

                        if (title.startsWith('&') || title.endsWith('&')) {
                            const pages = await list({
                                sortingKey: 'created_at',
                                sortCriteria: 'desc',
                                rangeStart: 0,
                                rangeEnd: 1,
                                searchKeyword: null,
                            });

                            if (pages.length > 0) {
                                const lastCreatePage = pages[0];

                                // @ts-ignore
                                updatedBody = lastCreatePage.body;

                                if (title.startsWith('&')) {
                                    // @ts-ignore
                                    titlePart = lastCreatePage.title;
                                    updatedBody += `<p>${title.slice(1)}</p>`;
                                    openSnackbar({
                                        message: t`${titlePart}에 내용을 추가했습니다`,
                                    });
                                } else if (title.endsWith('&')) {
                                    // @ts-ignore
                                    titlePart = lastCreatePage.title;
                                    updatedBody = `<p>${title.slice(0, -1)}</p>` + updatedBody;
                                    openSnackbar({
                                        message: t`${titlePart}의 앞에 내용을 추가했습니다`,
                                    });
                                }

                                id = lastCreatePage.id; // 마지막 생성 페이지의 ID 재사용
                            }
                        }

                        await editSubmitHandler(titlePart, updatedBody, false, id, 'text');
                        setTitle('');
                        setHasOverflowed(false); // Reset overflow state on submit
                        setSuggestions([]);
                        lastTriggerLengthRef.current = SUGGEST_MINIMUM_LENGTH;
                        if (redirect) {
                            navigate(redirect);
                        }
                    }}
                    onBlur={handleBlur}
                    placeholder={t`간단한 메모는 여기에 작성하세요.`}
                />
            </Wrapper>
            {suggestions.length > 0 && (
                <div className={`w-[100%] mb-4`}>
                    <div className="dark:text-white text-[12px] p-2 opacity-50">
                        {t`비슷한 메모에 내용을 추가해보세요.`}
                    </div>
                    {uniqueSuggestions.map((suggestion, index) => (
                        <div
                            key={suggestion.id}
                            className={`
                                focus-bg-color opacity-85 hover:opacity-100 
                                dark:text-white 
                                border-color
                                ${index > 0 && 'border-t-[1px] border-black'}
                                py-1 pl-3 cursor-pointer
                            `}
                        >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px' }}>
                                <div
                                    className="flex items-center text-sm truncate"
                                    onClick={async () => {
                                        editorIndexLogger('suggestion view clicked', suggestion);
                                        navigateToPageEdit(suggestion.page_id);
                                    }}
                                >
                                    {suggestion.metadata.title}
                                </div>
                                <div className="flex items-center">
                                    <Tooltip title={t`맨 앞에 추가`}>
                                        <IconButton
                                            onClick={() => insertPageToSuggested(suggestion, true)}
                                        >
                                            {loading[suggestion.page_id]?.prepend ? (
                                                <CircularProgress size={20} />
                                            ) : (
                                                <Prepend
                                                    width="22"
                                                    height="22"
                                                    className="fill-text-color "
                                                />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={t`끝에 추가`}>
                                        <IconButton
                                            onClick={() => insertPageToSuggested(suggestion, false)}
                                        >
                                            {loading[suggestion.page_id]?.append ? (
                                                <CircularProgress size={22} />
                                            ) : (
                                                <Prepend
                                                    width="22"
                                                    height="22"
                                                    className="fill-text-color "
                                                    style={{ transform: 'scaleY(-1)' }}
                                                />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
