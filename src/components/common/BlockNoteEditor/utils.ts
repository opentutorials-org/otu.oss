import { Block, BlockNoteEditor } from '@blocknote/core';
import { editorBlockNoteLogger, editorViewLogger } from '@/debug/editor';
import { blocknoteLogger } from '@/debug/blocknote';

// BlockNote 블록 타입과 HTML 태그 매핑 정의
const BLOCK_TYPE_TO_HTML_TAGS: Record<string, string[]> = {
    paragraph: ['p'],
    heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    bulletListItem: ['li', 'ul'], // li는 실제 블록, ul은 컨테이너
    numberedListItem: ['li', 'ol'], // li는 실제 블록, ol은 컨테이너
    checkListItem: ['li', 'ul'], // 체크리스트도 li 태그 사용
    quote: ['blockquote'],
    image: ['img', 'figure'], // img 또는 figure 태그로 렌더링 가능
    video: ['video', 'figure'],
    audio: ['audio', 'figure'],
    file: ['a', 'div'], // 파일은 링크나 div로 렌더링 가능
    table: ['table'],
    tableCell: ['td', 'th'], // 테이블 셀
    codeBlock: ['pre', 'code'], // 코드 블록
};

// 블록을 식별할 수 있는 모든 가능한 HTML 태그들
const ALL_BLOCK_TAGS = new Set([
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'ul',
    'ol',
    'li',
    'img',
    'figure',
    'video',
    'audio',
    'table',
    'tbody',
    'tr',
    'td',
    'th',
    'pre',
    'code',
    'div',
    'a',
]);

export const initializeBlockNoteFromHTML = async (
    editor: BlockNoteEditor,
    html: string | null | undefined
) => {
    if (html) {
        try {
            blocknoteLogger('🔄 initializeBlockNoteFromHTML 시작', {
                htmlLength: html.length,
                htmlPreview: html.substring(0, 100) + '...',
            });

            // figure 태그를 img 태그로 변환
            const transformedHtml = transformFigureToImg(html);

            // HTML에서 블록 ID 정보 추출 (개선된 방식)
            const savedBlockIds = extractBlockIdsFromHTML(transformedHtml);
            blocknoteLogger('📋 HTML에서 추출된 블록 ID들', {
                savedBlockIds,
                totalBlocks: savedBlockIds.length,
                extractionMethod: '포괄적 태그 검색',
            });

            const blocks = await editor.tryParseHTMLToBlocks(transformedHtml);
            const restoredBlocks = removeEmptyBlockSpaces(blocks);

            // 추출된 블록 ID를 복원
            const blocksWithRestoredIds = restoreBlockIds(restoredBlocks, savedBlockIds);

            blocknoteLogger('🔧 블록 ID 복원 완료', {
                originalBlockCount: restoredBlocks.length,
                restoredIdCount: blocksWithRestoredIds.filter((block) =>
                    savedBlockIds.some((saved) => saved.id === block.id)
                ).length,
                finalBlocks: blocksWithRestoredIds.map((block) => ({
                    id: block.id,
                    type: block.type,
                    hasProps: !!block.props,
                })),
            });

            // 현재 에디터의 모든 블록을 새 블록들로 교체
            // editor.document의 블록 ID들을 명시적으로 추출하여 전달
            const currentBlockIds = editor.document.map((block) => block.id);

            blocknoteLogger('🔄 블록 교체 시작', {
                currentBlockCount: currentBlockIds.length,
                newBlockCount: blocksWithRestoredIds.length,
                currentBlockIds,
                newBlockIds: blocksWithRestoredIds.map((b) => b.id),
            });

            if (currentBlockIds.length > 0) {
                // 기존 블록들을 새 블록들로 교체
                editor.replaceBlocks(currentBlockIds, blocksWithRestoredIds);
            } else if (blocksWithRestoredIds.length > 0) {
                // 에디터가 완전히 비어있으면 삽입
                editor.insertBlocks(blocksWithRestoredIds, editor.document[0]);
            }

            editorViewLogger('loadInitialHTML - 초기 HTML 로드 완료', {
                restoredBlocks: blocksWithRestoredIds,
            });
        } catch (error) {
            blocknoteLogger('❌ HTML 파싱 오류 발생', { error });
            editorViewLogger('loadInitialHTML - HTML 파싱 오류 발생', { error });
            console.error(
                'blocknote에서 본문을 읽는(tryParseHTMLToBlocks) 과정에서 오류가 발생했고, 사용자는 본문을 볼 수 없는 상황이 발생했습니다.',
                error
            );

            // 대체 표시를 위해 원본 HTML을 오류에 첨부
            (error as any).fallbackHtml = html;
            throw error;
        }
    } else {
        blocknoteLogger('📝 빈 본문 로드 완료');
        editorViewLogger('loadInitialHTML - 빈 본문 로드 완료');
    }

    // HTML에서 블록 ID를 추출하는 함수 (개선된 포괄적 방식)
    function extractBlockIdsFromHTML(
        html: string
    ): Array<{ id: string; index: number; tagName: string; isNested: boolean }> {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 모든 블록 ID가 있는 요소들을 찾기 (중첩 포함)
        const elementsWithBlockId = doc.querySelectorAll('[data-block-id]');

        const blockIds: Array<{ id: string; index: number; tagName: string; isNested: boolean }> =
            [];

        // 최상위 블록 요소들 (body의 직접 자식)
        const topLevelElements = Array.from(doc.body.children);
        let blockIndex = 0;

        elementsWithBlockId.forEach((element) => {
            const blockId = element.getAttribute('data-block-id');
            if (!blockId) return;

            const tagName = element.tagName.toLowerCase();

            // 최상위 요소인지 확인
            const isTopLevel = topLevelElements.includes(element as Element);

            if (isTopLevel) {
                // 최상위 요소는 순서대로 인덱스 부여
                blockIds.push({
                    id: blockId,
                    index: blockIndex++,
                    tagName,
                    isNested: false,
                });

                blocknoteLogger('🔍 최상위 블록 ID 발견', {
                    id: blockId,
                    index: blockIndex - 1,
                    tagName,
                    isNested: false,
                });
            } else {
                // 중첩 요소는 별도 처리 (예: 테이블 셀, 리스트 아이템 등)
                const parentWithBlockId = element.parentElement?.closest('[data-block-id]');
                const isNestedInBlock = !!parentWithBlockId;

                if (!isNestedInBlock) {
                    // 부모가 블록이 아닌 중첩 요소도 블록으로 처리
                    blockIds.push({
                        id: blockId,
                        index: blockIndex++,
                        tagName,
                        isNested: true,
                    });

                    blocknoteLogger('🔍 중첩 블록 ID 발견', {
                        id: blockId,
                        index: blockIndex - 1,
                        tagName,
                        isNested: true,
                    });
                }
            }
        });

        blocknoteLogger('📊 블록 ID 추출 통계', {
            totalElements: elementsWithBlockId.length,
            topLevelBlocks: blockIds.filter((b) => !b.isNested).length,
            nestedBlocks: blockIds.filter((b) => b.isNested).length,
            uniqueTags: [...new Set(blockIds.map((b) => b.tagName))],
            totalMappedBlocks: blockIds.length,
        });

        return blockIds;
    }

    // 블록 ID를 복원하는 함수 (개선된 방식)
    function restoreBlockIds(
        blocks: Block[],
        savedBlockIds: Array<{ id: string; index: number; tagName: string; isNested: boolean }>
    ): Block[] {
        return blocks.map((block, index) => {
            // 인덱스 기반 매칭 우선
            let savedId = savedBlockIds.find((saved) => saved.index === index);

            // 인덱스 매칭 실패 시, 블록 타입과 태그 매칭으로 시도
            if (!savedId) {
                const possibleTags = BLOCK_TYPE_TO_HTML_TAGS[block.type] || [];
                savedId = savedBlockIds.find(
                    (saved) =>
                        possibleTags.includes(saved.tagName) &&
                        !blocks
                            .slice(0, index)
                            .some((_, prevIndex) =>
                                savedBlockIds.some(
                                    (s) => s.index === prevIndex && s.id === saved.id
                                )
                            )
                );

                if (savedId) {
                    blocknoteLogger('🔄 타입 기반 블록 ID 매칭', {
                        blockType: block.type,
                        matchedTag: savedId.tagName,
                        originalId: block.id,
                        restoredId: savedId.id,
                        index,
                    });
                }
            }

            if (savedId) {
                blocknoteLogger('🔄 블록 ID 복원', {
                    originalId: block.id,
                    restoredId: savedId.id,
                    blockType: block.type,
                    matchedTag: savedId.tagName,
                    index,
                    matchMethod: savedId.index === index ? 'index' : 'type+tag',
                });
                return { ...block, id: savedId.id };
            }

            // 매칭 실패한 경우 로그
            blocknoteLogger('⚠️ 블록 ID 복원 실패', {
                blockId: block.id,
                blockType: block.type,
                index,
                availableIds: savedBlockIds.map((s) => ({
                    id: s.id,
                    tag: s.tagName,
                    index: s.index,
                })),
            });

            return block;
        });
    }

    // figure 태그를 img 태그로 변환하는 함수
    function transformFigureToImg(html: string): string {
        // DOMParser는 브라우저 환경에서만 사용 가능
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // figure.outset-both 태그 선택
        const figures = doc.querySelectorAll('figure.outset-both');

        figures.forEach((figure) => {
            // figure 내의 img 태그 찾기
            const img = figure.querySelector('img');
            if (img) {
                // 이미지의 src 속성 가져오기
                const imgSrc = img.getAttribute('src');

                // 새로운 img 요소 생성
                const newImg = doc.createElement('img');
                newImg.setAttribute('src', imgSrc || '');

                // data-block-id 속성도 복사
                const blockId = figure.getAttribute('data-block-id');
                if (blockId) {
                    newImg.setAttribute('data-block-id', blockId);
                }

                // figure 태그를 새로운 img 태그로 대체
                if (figure.parentNode) {
                    figure.parentNode.replaceChild(newImg, figure);
                }
            }
        });

        return doc.body.innerHTML;
    }

    // &nbsp;만 있는 paragraph를 빈 paragraph로 변환. 빈 블록을 유지하기 위해 &nbsp;를 추가했었음. 편집시 불편하기 때문에 이를 다시 제거.
    function removeEmptyBlockSpaces(blocks: Block[]) {
        return blocks.map((block) => {
            // Check if block is a paragraph with single non-breaking space
            const isEmptyParagraph =
                block.type === 'paragraph' &&
                block.content?.length === 1 &&
                block.content[0].type === 'text' &&
                block.content[0].text === '\u00A0';

            if (isEmptyParagraph) {
                // Return block with empty content array
                return {
                    ...block,
                    content: [],
                };
            }
            return block;
        });
    }
};

export const convertBlockNoteToHTML = async (editor: BlockNoteEditor): Promise<string> => {
    blocknoteLogger('💾 convertBlockNoteToHTML 시작', {
        blockCount: editor.document.length,
        blocks: editor.document.map((block) => ({
            id: block.id,
            type: block.type,
            hasProps: !!block.props,
        })),
    });

    editorBlockNoteLogger('convertBlockNoteToHTML - 본문을 HTML로 변환 시작');

    const html = await editor.blocksToHTMLLossy(editor.document);

    // 블록 ID를 HTML에 삽입 (개선된 포괄적 방식)
    const htmlWithBlockIds = insertBlockIdsToHTML(html, editor.document);

    // 빈 블록을 유지하기 위해 빈 paragraph 블록을 &nbsp;로 변환 (data-block-id 속성 포함)
    const finalHtml = htmlWithBlockIds.replace(/<p([^>]*)><\/p>/g, '<p$1>&nbsp;</p>');

    blocknoteLogger('✅ HTML 변환 완료', {
        originalLength: html.length,
        finalLength: finalHtml.length,
        addedBlockIds: editor.document.length,
        htmlPreview: finalHtml.substring(0, 200) + '...',
    });

    return finalHtml;

    // HTML에 블록 ID를 삽입하는 함수 (개선된 포괄적 방식)
    function insertBlockIdsToHTML(html: string, blocks: Block[]): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 모든 잠재적 블록 요소들을 찾기
        const allElements = Array.from(doc.body.querySelectorAll('*'));
        const blockElements = allElements.filter((element) =>
            ALL_BLOCK_TAGS.has(element.tagName.toLowerCase())
        );

        // body의 직접 자식 요소들 (최상위 블록들)
        const topLevelElements = Array.from(doc.body.children);

        blocknoteLogger('🔗 HTML에 블록 ID 삽입 중', {
            totalElements: allElements.length,
            potentialBlockElements: blockElements.length,
            topLevelElements: topLevelElements.length,
            blockCount: blocks.length,
            discoveredTags: [...new Set(blockElements.map((el) => el.tagName.toLowerCase()))],
        });

        let blockIndex = 0;

        // 최상위 요소들에 블록 ID 할당
        topLevelElements.forEach((element, index) => {
            if (blockIndex < blocks.length) {
                const block = blocks[blockIndex];
                element.setAttribute('data-block-id', block.id);

                blocknoteLogger('📌 최상위 블록 ID 삽입', {
                    index: blockIndex,
                    blockId: block.id,
                    blockType: block.type,
                    elementTag: element.tagName.toLowerCase(),
                    isTopLevel: true,
                });

                blockIndex++;

                // 복잡한 블록 내부의 하위 요소들도 확인
                const nestedBlockElements = element.querySelectorAll('*');
                nestedBlockElements.forEach((nestedElement) => {
                    const tagName = nestedElement.tagName.toLowerCase();

                    // 테이블 셀, 리스트 아이템 등 특별한 경우 처리
                    if (shouldTrackNestedElement(tagName, block.type)) {
                        if (blockIndex < blocks.length) {
                            const nestedBlock = blocks[blockIndex];
                            nestedElement.setAttribute('data-block-id', nestedBlock.id);

                            blocknoteLogger('📌 중첩 블록 ID 삽입', {
                                index: blockIndex,
                                blockId: nestedBlock.id,
                                blockType: nestedBlock.type,
                                elementTag: tagName,
                                parentBlockType: block.type,
                                isNested: true,
                            });

                            blockIndex++;
                        }
                    }
                });
            }
        });

        // 통계 로깅
        const insertedIds = doc.querySelectorAll('[data-block-id]').length;
        blocknoteLogger('📊 블록 ID 삽입 통계', {
            totalBlocksToInsert: blocks.length,
            actuallyInserted: insertedIds,
            insertionRate: `${Math.round((insertedIds / blocks.length) * 100)}%`,
            missedBlocks: Math.max(0, blocks.length - insertedIds),
        });

        return doc.body.innerHTML;
    }

    // 중첩 요소를 추적해야 하는지 판단하는 함수
    function shouldTrackNestedElement(tagName: string, parentBlockType: string): boolean {
        const nestedTrackingRules: Record<string, string[]> = {
            table: ['td', 'th'], // 테이블의 셀들
            bulletListItem: [], // 리스트 아이템 내부는 추적하지 않음
            numberedListItem: [], // 리스트 아이템 내부는 추적하지 않음
            checkListItem: [], // 체크리스트 아이템 내부는 추적하지 않음
        };

        const allowedNestedTags = nestedTrackingRules[parentBlockType] || [];
        return allowedNestedTags.includes(tagName);
    }
};
