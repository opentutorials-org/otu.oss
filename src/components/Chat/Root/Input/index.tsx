import {
    PlanItemType,
    Similarity_data,
    chatSessionState,
    chatSessionInitial,
    MessageType,
    chatMessagesState,
    MessageItem,
    chatScrollToBottomState,
    similarityResponse,
    askLLMContext,
    OptionItem,
    currentPageState,
    openSnackbarState,
} from '@/lib/jotai';
import { View } from './view';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import React, { useEffect, useRef, useState } from 'react';
import { useChatProcess } from './useChatProcess';
import { ulid } from 'ulid';
import { chatLogger } from '@/debug/chat';
import { get } from '@/watermelondb/control/Page';
import { RAG_SEARCH_MIN_LENGTH_THRESHOLD } from '@/functions/constants';
import { useTranslations } from 'next-intl';

const welcomeMessages = [''];

let reader: ReadableStreamDefaultReader<Uint8Array>;
export default function Input({ showScrollButton }: { showScrollButton: boolean }) {
    const t = useTranslations('chat');
    const tErrors = useTranslations('api.errors');
    const [chatSession, setAiSession] = useAtom(chatSessionState);
    const [chatMessages, setChatMessages] = useAtom(chatMessagesState);
    const currentPage = useAtomValue(currentPageState);
    const openSnackbar = useSetAtom(openSnackbarState);
    const askLLMContextInit = {
        message: '',
        references: [],
        history: [],
        option: {
            ai: null,
            rag: 'none',
        },
    };
    const askLLMContextRef = useRef<askLLMContext>(askLLMContextInit);
    const { add, run, reset } = useChatProcess();
    const [placeholderMessage, setPlaceholderMessage] = useState<string>(
        welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
    );
    useEffect(() => {
        if (chatMessages.length === 0) {
            askLLMContextRef.current = askLLMContextInit;
        }
    }, [chatMessages]);
    const { scroll } = useChatScroll();
    function handleChange(value: string) {
        setAiSession((draft: chatSessionState) => {
            draft.inputMessage = value;
        });
    }
    function resetInputMessage() {
        setAiSession((draft: chatSessionState) => {
            draft.inputMessage = '';
        });
    }
    function runPrompt(value: string): string {
        const message: MessageItem = {
            id: ulid(),
            type: MessageType.Request,
            name: t('me'),
            content: value,
        };
        setChatMessages((draft: MessageItem[]) => {
            draft.push(message);
        });
        scroll({ smooth: false });
        chatLogger('runPrompt', 'message', message);
        return value;
    }
    async function runReference(
        message: string,
        option: string | null
    ): Promise<similarityResponse[]> {
        if (!message) {
            throw new Error('message content is null');
        }
        if (!option || option === 'none') {
            chatLogger('runReference', 'No ARG found in message content');
            return [];
        }

        const isCurrentRag = askLLMContextRef.current.option.rag === 'current';
        let page_id = isCurrentRag && currentPage.id ? currentPage.id : null;

        if (isCurrentRag && page_id) {
            const immediateResponse = await getImmediateResponseIfEligible(page_id);
            if (immediateResponse) {
                return [immediateResponse];
            } else {
                const similarityStartMessage = createSimilarityStartMessage();
                setChatMessages((draft: MessageItem[]) => {
                    draft.push(similarityStartMessage);
                });
                chatLogger('runReference', 'similarityStartMessage', similarityStartMessage);
            }
        }

        let result;
        try {
            result = await getSimilarity(message, page_id);
        } catch (error) {
            chatLogger('runReference', 'error', error);
            return [];
        }

        if (!result || result.length === 0) {
            if (isCurrentRag && page_id) {
                const immediateResponse = await getImmediateResponseWithTruncatedContent(page_id);
                if (immediateResponse) {
                    return [immediateResponse];
                }
            }
            const noResultMessage = createNoResultMessage();
            setChatMessages((draft: MessageItem[]) => {
                draft.push(noResultMessage);
            });
            chatLogger('runReference', 'No similarity result found');
            return [];
        }

        const similarityEndMessage = {
            id: ulid(),
            type: MessageType.SimilarityResponseEnd,
            name: 'OTU',
            content: result,
        };
        chatLogger('runReference', 'similarityEndMessage', similarityEndMessage);
        setChatMessages((draft: MessageItem[]) => {
            draft.push(similarityEndMessage);
        });
        scroll({ smooth: true });
        chatLogger('runReference', 'Find similarity result', result);
        return result;
    }

    async function getImmediateResponseIfEligible(
        page_id: string
    ): Promise<similarityResponse | null> {
        const page = await get(page_id);
        // @ts-ignore
        const titleAndBody = `title:${page.title}, body:${page.body}`;
        if (titleAndBody.length <= RAG_SEARCH_MIN_LENGTH_THRESHOLD) {
            const immediateResponseMessage: similarityResponse = {
                id: ulid(),
                type: MessageType.SimilarityResponseEnd,
                name: 'OTU',
                // @ts-ignore
                metadata: { title: page.title },
                similarity: 1,
                // @ts-ignore
                content: page.body,
            };
            chatLogger(
                'runReference',
                'Immediate response with title and content',
                immediateResponseMessage
            );
            return immediateResponseMessage;
        }

        return null;
    }

    async function getImmediateResponseWithTruncatedContent(
        page_id: string
    ): Promise<similarityResponse | null> {
        const page = await get(page_id);
        // @ts-ignore
        const titleAndBody = `title:${page.title}, body:${page.body}`;
        const truncatedContent = titleAndBody.substring(0, RAG_SEARCH_MIN_LENGTH_THRESHOLD);
        const immediateResponseMessage: similarityResponse = {
            id: ulid(),
            type: MessageType.SimilarityResponseEnd,
            name: 'OTU',
            // @ts-ignore
            metadata: { title: page.title },
            similarity: 1,
            content: truncatedContent,
        };
        chatLogger(
            'runReference',
            'Immediate response with truncated content',
            immediateResponseMessage
        );
        return immediateResponseMessage;
    }

    function createSimilarityStartMessage() {
        return {
            id: ulid(),
            type: MessageType.SimilarityResponseStart,
            name: 'OTU',
            content: t('similarity.searching'),
        };
    }

    function createNoResultMessage() {
        return {
            id: ulid(),
            type: MessageType.SimilarityResponseEndNotFound,
            name: 'OTU',
            content: t('similarity.not-found'),
        };
    }
    async function runAskLLM({
        message,
        references,
        history,
        option,
    }: askLLMContext): Promise<string[]> {
        chatLogger('runAskLLM', 'context', message, references, history);
        let result = [];
        const response = await fetch(`/api/ai/askLLM/openai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                references,
                history,
            }),
        });

        // HTTP 429 (사용량 한도 초과) 처리
        if (response.status === 429) {
            try {
                const errorData = await response.json();

                // OTU 사용량 한도 초과 vs OpenAI API 한도 초과 구분
                const isUserQuotaExceeded = errorData.errorCode === 'USER_QUOTA_EXCEEDED';
                const isExternalRateLimit = errorData.errorCode === 'EXTERNAL_SERVICE_RATE_LIMIT';

                if (isUserQuotaExceeded) {
                    // OTU 사용량 한도 초과 - 리셋 날짜 정보 포함
                    const quotaError: any = new Error(
                        errorData.message || tErrors('user-quota-exceeded-fallback')
                    );
                    quotaError.isQuotaExceeded = true;
                    quotaError.status = 429;
                    quotaError.resetInfo = errorData.message;
                    chatLogger('runAskLLM', 'User quota exceeded', quotaError);
                    throw quotaError;
                } else if (isExternalRateLimit) {
                    // 외부 API 한도 초과 - 재시도 안내
                    const rateLimitError: any = new Error(
                        errorData.message || tErrors('external-rate-limit-fallback')
                    );
                    rateLimitError.isExternalRateLimit = true;
                    rateLimitError.status = 429;
                    chatLogger('runAskLLM', 'External rate limit', rateLimitError);
                    throw rateLimitError;
                } else {
                    // 하위 호환성: errorCode가 없는 경우 기존 동작 유지
                    const quotaError: any = new Error(
                        errorData.message || tErrors('user-quota-exceeded-fallback')
                    );
                    quotaError.isQuotaExceeded = true;
                    quotaError.status = 429;
                    quotaError.resetInfo = errorData.message;
                    chatLogger('runAskLLM', 'Quota exceeded (legacy)', quotaError);
                    throw quotaError;
                }
            } catch (parseError) {
                // parseError가 quotaError 또는 rateLimitError인 경우 그대로 throw
                if (
                    (parseError as any).isQuotaExceeded ||
                    (parseError as any).isExternalRateLimit
                ) {
                    throw parseError;
                }
                // JSON 파싱 실패 시 기본 메시지 사용
                const quotaError: any = new Error(tErrors('user-quota-exceeded-fallback'));
                quotaError.isQuotaExceeded = true;
                quotaError.status = 429;
                throw quotaError;
            }
        }

        if (!response.ok) {
            throw new Error('언어모델의 응답이 없습니다.');
        }

        result.push(await readResponse(response));
        return result;
    }

    async function readResponse(response: Response) {
        chatLogger('readResponse start', 'response', response);
        const id = ulid();
        if (reader) {
            reader.cancel();
        }
        if (response.body) {
            reader = response.body.getReader();
        }
        let result = '';
        const decoder = new TextDecoder();

        let first = true;
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                chatLogger('readResponse done', 'result', result);
                return result;
            }

            result += decoder.decode(value, { stream: true });

            // UI 업데이트
            if (result) {
                setChatMessages((draft: MessageItem[]) => {
                    const index = draft.findIndex((item) => item.id === id);
                    if (index === -1) {
                        draft.push({
                            id: id,
                            type: MessageType.LLMResponse,
                            name: 'OTU',
                            content: result,
                        });
                    } else {
                        draft[index].content = result;
                    }
                });

                if (first) {
                    setTimeout(() => {
                        scroll({ smooth: true });
                        chatLogger('readResponse first stream', value);
                    }, 100);
                    first = false;
                }
            }
        }
    }

    async function handleSubmit(
        value: string,
        option: {
            ai: OptionItem | null;
            rag: string;
        }
    ) {
        chatLogger('handleSubmit', 'value', value, 'option', option);
        resetInputMessage();
        askLLMContextRef.current = {
            ...askLLMContextRef.current,
            message: '',
            references: [],
            option,
        };
        const message = runPrompt(value);
        askLLMContextRef.current.message = value;
        askLLMContextRef.current.history = [
            ...askLLMContextRef.current.history,
            {
                role: 'user',
                content: message,
            },
        ];
        chatLogger('after runPrompt askLLMContextRef', askLLMContextRef.current);
        const references = await runReference(message, option.rag);
        if (references.length > 0) {
            askLLMContextRef.current.references = references;
        }
        chatLogger('after runReference askLLMContextRef', askLLMContextRef.current);

        try {
            const llmResponse = await runAskLLM(askLLMContextRef.current);
            llmResponse.forEach((response) => {
                askLLMContextRef.current.history = [
                    ...askLLMContextRef.current.history,
                    {
                        role: 'assistant',
                        content: response,
                    },
                ];
            });
            setPlaceholderMessage(
                welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
            );
            chatLogger('after runAskLLM askLLMContextRef', askLLMContextRef.current);
        } catch (error: any) {
            chatLogger('handleSubmit error', error);

            // 에러 메시지 표시
            openSnackbar({
                message: error.message || '언어모델의 응답이 없습니다.',
            });

            // 에러 메시지를 채팅에 추가
            setChatMessages((draft: MessageItem[]) => {
                draft.push({
                    id: ulid(),
                    type: MessageType.LLMResponse,
                    name: 'OTU',
                    content: `⚠️ ${error.message || '언어모델의 응답이 없습니다.'}`,
                });
            });
            scroll({ smooth: true });
        }
    }
    return (
        <View
            value={chatSession.inputMessage}
            placeholder={placeholderMessage}
            onChange={handleChange}
            onSubmit={handleSubmit}
            showScrollButton={showScrollButton}
        ></View>
    );
}

function useChatScroll() {
    const [chatScrollToBottom, setChatScrollToBottom] = useAtom(chatScrollToBottomState);
    function scroll({ smooth }: { smooth: boolean }) {
        setChatScrollToBottom(Math.random() * (smooth ? 1 : -1));
    }
    return { scroll };
}

const getSimilarity = async (
    message: string,
    page_id: string | null = null
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
            }),
        });
        const result = await response.json();
        return result.data;
    } catch (error) {
        throw error;
    }
};
