import { chatLogger } from '@/debug/chat';
import {
    LLM_ask_data,
    MessageType,
    PlanItem,
    PlanItemType,
    Prompt_data,
    Similarity_data,
    chatSessionState,
    chatScrollToBottomState,
    MessageItem,
    similarityResponse,
} from '@/lib/jotai';
import { useAtom, useSetAtom } from 'jotai';
import { sleep } from 'openai/core';
import { useCallback, useRef, useEffect } from 'react';
import { ulid } from 'ulid';
import { useLingui } from '@lingui/react/macro';

export function useChatProcess() {
    const { t } = useLingui();
    const planRef = useRef<PlanItem[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [chatSession, setChatSession] = useAtom(chatSessionState);
    const setChatScrollToBottom = useSetAtom(chatScrollToBottomState);
    const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
    // jotai 상태를 이용하면 컴포넌트 랜더링 타임에 따라서 데이터가 제대로 적재되지 않는 문제가 있어서 useRef를 이용합니다.
    // const llmContextRef = useRef<{
    //     message:string,
    //     references:similarityResponse[],
    //     contextMessages:contextMessage[]
    // }>({
    //     message:'',
    //     references: [],
    //     contextMessages: []
    // });

    // 컴포넌트가 언마운트될 때 진행 중인 요청을 취소하기 위한 useEffect
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (readerRef.current) {
                readerRef.current.cancel();
                readerRef.current = null;
            }
        };
    }, []);

    const getSimilarity = async (message: string): Promise<similarityResponse[]> => {
        try {
            // 이전 요청이 있으면 취소
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // 새로운 AbortController 생성
            abortControllerRef.current = new AbortController();

            const response = await fetch('/api/ai/similaritySearch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputMessage: message,
                }),
                signal: abortControllerRef.current.signal,
            });
            if (!response.ok) {
                throw new Error(`Similarity search failed: ${response.status}`);
            }
            const result = await response.json();
            return result.data;
        } catch (error) {
            // AbortError는 정상적인 취소이므로 다시 throw하지 않음
            if (error instanceof Error && error.name === 'AbortError') {
                chatLogger('Similarity search aborted');
                return [];
            }
            throw error;
        }
    };
    type contextMessage = {
        role: 'user' | 'assistant';
        content: string | null;
    };
    async function askLLM(
        provider: string,
        message: string,
        references: similarityResponse[],
        contextMessages: contextMessage[]
    ): Promise<Response> {
        // 이전 요청이 있으면 취소
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // 새로운 AbortController 생성
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`/api/ai/askLLM/${provider}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    references,
                    contextMessages,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response || !response.body || !response.ok) {
                throw new Error('언어모델의 응답이 없습니다.');
            }

            return response;
        } catch (error) {
            // AbortError는 정상적인 취소이므로 다른 에러 메시지로 대체
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('요청이 취소되었습니다.');
            }
            throw error;
        }
    }
    async function readResponse(response: Response) {
        if (readerRef.current) {
            readerRef.current.cancel();
        }
        if (!response.body) {
            chatLogger('readResponse: response.body is null');
            return;
        }
        const reader = response.body.getReader();
        readerRef.current = reader;
        let result = '';
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }
                result += decoder.decode(value, { stream: true });
            }
        } catch (error) {
            chatLogger('readResponse stream error', error);
            if (readerRef.current === reader) {
                readerRef.current = null;
            }
            throw error;
        }
    }
    const handlePrompt = useCallback((data: Prompt_data): MessageItem => {
        const message = {
            id: ulid(),
            type: MessageType.Request,
            name: t`나`,
            content: data.message,
        };
        setChatSession((draft) => {
            draft.messages.push(message);
        });
        scroll({ smooth: false });
        return message;
    }, []);

    const handleSimilarity = useCallback(
        async (data: Similarity_data): Promise<similarityResponse[]> => {
            setChatSession((draft) => {
                const target = draft.messages.push({
                    id: ulid(),
                    type: MessageType.SimilarityResponseStart,
                    name: 'OTU',
                    content: t`질문과 관련된 자료를 찾고 있어요.`,
                });
            });
            const result = await getSimilarity(data.query);
            const messageResult = {
                id: ulid(),
                type: MessageType.SimilarityResponseEnd,
                name: 'OTU',
                content:
                    result.length === 0 ? null : result.map((item: any) => item.content).join('\n'),
            };
            setChatSession((draft) => {
                draft.messages.push(messageResult);
            });
            scroll({ smooth: true });
            return result;
        },
        []
    );

    const handleLLMAsk = useCallback(
        async (data: LLM_ask_data) => {
            // immer 갱신 타이밍 때문에 마지막 message는 여기에 포함되지 않습니다.
            const contextMessages = chatSession.messages.map<contextMessage>((message) => {
                return {
                    role: message.type === MessageType.Request ? 'user' : 'assistant',
                    content: message.content,
                };
            });
            await askLLM(data.llm_id, data.message, data.references, contextMessages);
        },
        [chatSession.messages]
    );
    const add = useCallback((plan: PlanItem) => {
        planRef.current.push(plan);
        chatLogger(1);
    }, []);
    const run = useCallback(async () => {
        let references: similarityResponse[] = [];
        for (let i = 0; i < planRef.current.length; i++) {
            const plan = planRef.current[i];
            switch (plan.type) {
                case PlanItemType.PROMPT:
                    handlePrompt(plan.data);
                    break;
                case PlanItemType.SIMILARITY:
                    const result = await handleSimilarity(plan.data);
                    references = result;
                    break;
                case PlanItemType.LLM_ASK:
                    const data = plan.data;
                    data.references = references;
                    handleLLMAsk(data);
                    break;
            }
        }
    }, []);
    const reset = useCallback(() => {
        planRef.current = [];
    }, []);
    return { add, run, reset };

    function scroll({ smooth }: { smooth: boolean }) {
        setChatScrollToBottom(Math.random() * (smooth ? 1 : -1));
    }
}
