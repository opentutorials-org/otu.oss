// prompt.tsx

import { similarityResponse } from '@/lib/jotai';

export function generateInstructions() {
    return (
        'Please read the instructions and the reference(s) carefully before answering. ' +
        'Your answer should be concise, and in the language of the inquirer. ' +
        'Use HTML for formatting. Allowed tags: <ul>, <ol>, <li>, <a> (with target="_blank"), ' +
        '<strong>, <u>, <br>, <p>, <table>, <pre>, trimmed <code>. ' +
        'Avoid Markdown.'
    );
}

export function generatePrompt(
    lastReference: similarityResponse[],
    message: string,
    userLabel: string = 'user',
    assistantLabel: string = 'assistant'
) {
    let prompt = '';

    let delimiter = '\n---\n';

    if (lastReference.length > 0) {
        prompt +=
            'If the question is related to the provided reference(s), your answer should build on that context. ';
        prompt +=
            'Otherwise, answer the question directly without needing to fit it within the reference context. ';
        let referencesFormatted = lastReference
            .map(
                (r, index) =>
                    `Reference ${index + 1}: title: ${r.metadata.title}, body: ${r.content}`
            )
            .join('\n\n');
        prompt += `References:\n${referencesFormatted}${delimiter}`;
    }

    prompt += `${userLabel}: ${message}${delimiter}${assistantLabel}:`;

    return prompt;
}
