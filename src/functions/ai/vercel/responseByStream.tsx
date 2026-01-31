export function responseByStream(message: string) {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(message));
            controller.close();
        },
    });
    return new Response(stream, {
        headers: { 'Content-Type': 'application/octet-stream' },
    });
}
