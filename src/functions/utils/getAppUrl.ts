import { headers } from 'next/headers';

/**
 * 서버 사이드에서 앱의 URL을 동적으로 가져옵니다.
 * headers()를 사용하므로 동적 렌더링이 됩니다.
 *
 * 프로토콜 감지 우선순위:
 * 1. x-forwarded-proto 헤더 (Vercel/리버스 프록시 환경)
 * 2. host 기반 추론 (localhost/사설 IP → http, 그 외 → https)
 */
export async function getAppUrl(): Promise<string> {
    const h = await headers();
    const host = h.get('host');
    if (!host) return 'https://otu.ai';

    const forwarded = h.get('x-forwarded-proto');
    const protocol = forwarded ?? (isLocalHost(host) ? 'http' : 'https');

    return `${protocol}://${host}`;
}

function isLocalHost(host: string): boolean {
    const hostname = host.split(':')[0];
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
}
