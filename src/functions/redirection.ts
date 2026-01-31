type RedirectFunction = () => void;
/**
 * 주어진 조건에 따라 리디렉션을 수행하는 함수입니다.
 *
 * @param {boolean} shouldRedirect - 리디렉션을 수행해야 하는지 여부를 나타냅니다.
 * @param {RedirectFunction} onRedirect - 리디렉션을 수행할 때 호출되는 콜백 함수입니다.
 * @param {number} redirectLimit - 리디렉션을 수행할 수 있는 최대 횟수입니다.
 * @throws {Error} 리디렉션 횟수가 redirectLimit을 초과하면 에러를 발생시킵니다.
 */
export function redirectIfConditionMet(
    shouldRedirect: boolean,
    onRedirect: RedirectFunction,
    redirectLimit: number
): void {
    let redirectCount: number;
    let _redirectCount = localStorage.getItem('redirectCount');
    if (_redirectCount === null) {
        localStorage.setItem('redirectCount', '0');
        redirectCount = 0;
    } else {
        redirectCount = parseInt(_redirectCount);
    }

    if (shouldRedirect) {
        if (redirectCount < redirectLimit) {
            localStorage.setItem('redirectCount', (redirectCount + 1).toString()); // 리디렉션 횟수를 증가시키고 로컬 스토리지에 저장합니다.
            onRedirect();
        } else {
            localStorage.setItem('redirectCount', '0');
            throw new Error('Redirect limit exceeded');
        }
    } else {
        localStorage.setItem('redirectCount', '0');
    }
}
