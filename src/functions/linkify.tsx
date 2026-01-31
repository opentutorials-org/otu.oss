import React from 'react';
import { openExternalLink } from '../utils/openExternalLink';

export const linkify = (text: string) => {
    const urlRegex =
        /\b(?:https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]/gi;
    const parts = text.split(urlRegex);
    const matches = text.match(urlRegex) || [];

    const result = [];
    for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
            result.push(parts[i]);
        }
        if (matches[i]) {
            const url = matches[i].startsWith('www.') ? `http://${matches[i]}` : matches[i];
            result.push(
                <a
                    key={`link-${i}`}
                    href={url}
                    className="text-blue-500 underline cursor-pointer"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openExternalLink(url);
                    }}
                >
                    {matches[i]}
                </a>
            );
        }
    }

    return result;
};
