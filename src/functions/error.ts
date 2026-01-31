import * as Sentry from '@sentry/nextjs';

// 환경변수로 Sentry 활성화 여부 제어
const ENABLE_SENTRY = process.env.NEXT_PUBLIC_ENABLE_SENTRY === 'true';

export function reportErrorToSentry(msg: any) {
    if (!ENABLE_SENTRY) {
        return;
    }
    const _msg = msg ? msg : 'No Message';
    Sentry.captureException(_msg);
}
