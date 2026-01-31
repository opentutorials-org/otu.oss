import { editorIndexLogger } from '@/debug/editor';
import { DELIMITER_TITLE_BODY } from '@/functions/constants';

export function parseTitleAndBody(input: string): { title: string; body: string } {
    let title = input;
    let body = '';

    const hasTitleAndBodyDelimiter = input.includes(DELIMITER_TITLE_BODY);

    editorIndexLogger('제목과 본문 분리 시작', {
        input,
        DELIMITER_TITLE_BODY,
        hasTitleAndBodyDelimiter,
    });

    if (hasTitleAndBodyDelimiter) {
        const parts = input.split(DELIMITER_TITLE_BODY);

        // ..로만 끝나는 경우 (예: "제목..")는 제목만 있는 것으로 처리
        if (input.endsWith(DELIMITER_TITLE_BODY)) {
            title = parts[0].trim().replace(/\n/g, ''); // 제목의 줄바꿈은 제거
            body = ''; // 본문은 비움
            editorIndexLogger('구분자로 끝남 - 제목만 있음', { title, body });
        }
        // 구분자 뒤에 내용이 있는 경우 (예: "제목..본문" 또는 "..본문")
        else {
            title = parts[0].trim().replace(/\n/g, ''); // 제목의 줄바꿈은 제거
            body = parts.slice(1).join(DELIMITER_TITLE_BODY).trim().replace(/\n/g, '<br>'); // 본문의 줄바꿈을 <br>로 변환

            // 제목이 비어있고 본문이 있는 경우 (..본문 형식)
            if (title === '' && body !== '') {
                editorIndexLogger('제목 없음, 본문만 있음 (..본문 형식)', { title, body });
            } else {
                editorIndexLogger('제목과 본문 분리 결과', { title, body });
            }
        }
    } else {
        editorIndexLogger('구분자 없음 - 전체가 제목', { title });
    }

    return { title, body };
}
