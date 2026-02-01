// Stub: @vercel/flags — Docker 셀프호스팅 환경용 no-op 구현
// Vercel 배포 시에는 npm ci로 설치된 실제 패키지가 사용됩니다.
// Docker 빌드 시에만 이 파일이 실제 패키지의 JS 파일을 덮어씁니다.
export function reportValue() {}
export function decrypt() {
    return '';
}
export function encrypt() {
    return '';
}
export function safeJsonStringify(value) {
    return JSON.stringify(value);
}
export function verifyAccess() {
    return false;
}
