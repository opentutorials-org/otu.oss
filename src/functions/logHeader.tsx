import { NextRequest } from 'next/server';
import { middleWareLogger } from '@/debug/middleware';

export function logHeader(req: NextRequest): void {
    const requestId = req.headers.get('x-request-id');
    middleWareLogger(`API ROUTE : ${requestId} → ${new URL(req.url).pathname}`);
}

export function generateIdentifier(length: number = 6): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 제외(O, I, 1, 0)
    let identifier = '';
    for (let i = 0; i < length; i++) {
        identifier += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return identifier;
}
