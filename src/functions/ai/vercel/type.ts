import { contextMessage, similarityResponse } from '@/lib/jotai';

export type askLLMRequestType = {
    message: string;
    references: similarityResponse[];
    history: contextMessage[];
    model: string;
};
