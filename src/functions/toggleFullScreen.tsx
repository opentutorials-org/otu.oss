export function toggleFullScreen(elem: HTMLElement, enterFullScreen: boolean) {
    if (enterFullScreen) {
        // 전체 화면 모드 진입
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
            // @ts-ignore
        } else if (elem.mozRequestFullScreen) {
            /* Firefox */
            // @ts-ignore
            elem.mozRequestFullScreen();
            // @ts-ignore
        } else if (elem.webkitRequestFullscreen) {
            /* Chrome, Safari & Opera */
            // @ts-ignore
            elem.webkitRequestFullscreen();
            // @ts-ignore
        } else if (elem.msRequestFullscreen) {
            /* IE/Edge */
            // @ts-ignore
            elem.msRequestFullscreen();
        }
    } else {
        // 전체 화면 모드 해제
        if (document.exitFullscreen) {
            document.exitFullscreen();
            // @ts-ignore
        } else if (document.mozCancelFullScreen) {
            /* Firefox */
            // @ts-ignore
            document.mozCancelFullScreen();
            // @ts-ignore
        } else if (document.webkitExitFullscreen) {
            /* Chrome, Safari & Opera */
            // @ts-ignore
            document.webkitExitFullscreen();
            // @ts-ignore
        } else if (document.msExitFullscreen) {
            /* IE/Edge */
            // @ts-ignore
            document.msExitFullscreen();
        }
    }
    return document.fullscreenElement;
}
