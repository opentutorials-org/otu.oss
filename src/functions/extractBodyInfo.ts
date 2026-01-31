'use client';
export function extractBodyInfo(title: string, body: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(body, 'text/html');
    // 동기화를 위한 length는 실제 전송되는 원본 데이터의 크기를 반영해야 함
    // innerText가 아닌 원본 HTML 문자열의 길이를 사용
    const bodyLength = body.length;
    const titleLength = title.length;
    const length = titleLength + bodyLength;
    const img = doc.querySelector('img');
    const img_url = img ? img.src : null;

    return { length, img_url };
}
