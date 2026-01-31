'use client';
export function isMobile() {
    // 서버사이드에서는 기본값으로 false 반환
    if (typeof window === 'undefined') {
        return false;
    }

    // Check for touch events (reliable for mobile devices)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        return true;
    }

    // Check user agent for fallback
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex =
        /android|iphone|ipod|ipad|windows phone|blackberry|bb10|rim tablet os|opera mini/i;
    return mobileRegex.test(userAgent);
}
