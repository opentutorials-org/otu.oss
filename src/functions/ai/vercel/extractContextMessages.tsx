import { ChatCompletionMessageParam } from 'openai/resources';

type contextMessage = {
    role: 'user' | 'assistant';
    content: string;
};

type ExtractContextMessagesParams = {
    contextLength: number;
    history: contextMessage[];
    roleKey?: keyof contextMessage;
    contentKey?: keyof contextMessage;
    userName?: string;
    assistantName?: string;
};

export function extractContextMessages({
    contextLength,
    history,
    roleKey = 'role',
    contentKey = 'content',
    userName = 'user',
    assistantName = 'assistant',
}: ExtractContextMessagesParams) {
    const contextMessages: ChatCompletionMessageParam[] = [];
    const messages = history.slice(0, -1).slice(-contextLength);
    const roleValueMap: { [key: string]: 'user' | 'assistant' } = {
        user: 'user',
        assistant: 'assistant',
    };

    for (const message of messages) {
        const newMessage: ChatCompletionMessageParam = {
            role: roleValueMap[message[roleKey] as string] || 'user', // roleKey 사용
            content: message[contentKey] as string, // contentKey 사용
        };
        contextMessages.push(newMessage);
    }

    return contextMessages;
}
