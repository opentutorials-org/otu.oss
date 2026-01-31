/**
 * 햅틱 피드백을 제공하는 유틸리티 함수
 *
 * - 안드로이드: Web Vibration API 사용
 * - iOS: 네이티브 브릿지 호출
 *
 * @param duration 진동 지속 시간(ms), 기본값 50ms
 */
import { communicateWithAppsWithCallback } from '@/components/core/WebViewCommunicator';

export function requestHapticFeedback(duration = 40) {
    // 웹 API 사용 (안드로이드)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(duration);
        return;
    }

    // iOS 또는 웹 API를 지원하지 않는 경우 네이티브 브릿지 호출
    communicateWithAppsWithCallback('requestHapticFeedbackToNative');
}

/**
 * 다양한 패턴의 햅틱 피드백을 제공
 *
 * @param pattern 'success' | 'warning' | 'error' | 'tap' | 'select'
 */
