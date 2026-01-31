import { OptionItem } from '@/lib/jotai';

export const aiOptions: OptionItem[] = [
    {
        description: '똑똑해요',
        value: 'gpt-4o',
        displayLabel: 'OpenAI GPT-4o',
        provider: 'openai',
    },
    {
        description: '빠르고,저렴해요',
        value: 'gpt-3.5-turbo',
        displayLabel: 'OpenAI GPT-3.5',
        provider: 'openai',
    },
    {
        description: '빠르고, 저렴해요',
        value: 'google/gemini-2.5-flash',
        displayLabel: 'Google Gemini 2.5 Flash',
        provider: 'google',
    },
];

export const DEFAULT_LLM = aiOptions[0];
