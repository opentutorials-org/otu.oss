export function detectOS() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // MacOS 감지
    if (platform.includes('Mac')) {
        return 'MacOS';
    }

    // Windows 감지
    if (platform.includes('Win')) {
        return 'Windows';
    }

    // Linux 감지
    if (platform.includes('Linux')) {
        return 'Linux';
    }

    // 기타 운영체제 감지
    if (/Android/.test(userAgent)) {
        return 'Android';
    }

    if (/iOS|iPhone|iPad|iPod/.test(userAgent)) {
        return 'IOS';
    }

    // 알 수 없는 경우
    return 'Unknown';
}
