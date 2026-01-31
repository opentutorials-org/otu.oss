import { NextRequest, NextResponse } from 'next/server';
import { aiLogger } from '@/debug/ai';

/**
 * OpenAI Chat API 스타일 SSE 응답을 처리하는 함수
 * @param req - Next.js API 요청 객체
 * @param message - 전송할 단일 문자열 메시지
 * @returns - SSE 형식의 NextResponse
 */
export function sendOpenaiChatSSE(req: NextRequest, message: string) {
    const stream = new ReadableStream({
        start(controller) {
            aiLogger('Client connected to SSE');

            // OpenAI Chat API 포맷 데이터 생성
            const data = {
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                choices: [
                    {
                        delta: { content: message },
                        index: 0,
                        finish_reason: null,
                    },
                ],
            };

            // 모든 텍스트를 한 번에 전송
            const response = `data: ${JSON.stringify(data)}\n\n` + `data: [DONE]\n\n`;
            controller.enqueue(response);

            // 스트림 종료
            controller.close();

            // 클라이언트가 연결 종료 시 처리
            req.signal.addEventListener('abort', () => {
                aiLogger('Client disconnected from SSE');
                controller.close();
            });
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    });
}
