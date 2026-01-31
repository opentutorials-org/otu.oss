import React, { useState, useCallback, useRef } from 'react';
import TextareaAutosize from '@mui/material/TextareaAutosize';
import { linkify } from '../../../../../../functions/linkify';
import { MAX_TEXT_LENGTH } from '../../../../../../functions/validation/textLength';
import s from '../style.module.css';

interface LinkifiedTitleProps {
    title: string;
    onTitleChange: (title: string) => void;
    placeholder: string;
    autoFocus?: boolean;
}

export const LinkifiedTitle: React.FC<LinkifiedTitleProps> = ({
    title,
    onTitleChange,
    placeholder,
    autoFocus = false,
}) => {
    const [isEditing, setIsEditing] = useState(autoFocus);
    const [cursorPosition, setCursorPosition] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const titleDivRef = useRef<HTMLDivElement>(null);

    // 공통 스타일 정의 - 두 모드에서 완전히 동일한 레이아웃 보장
    const commonContainerStyle: React.CSSProperties = {
        minHeight: '32px', // 22px font + padding을 고려한 최소 높이
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
    };

    const commonTextStyle: React.CSSProperties = {
        fontSize: '22px',
        fontWeight: '600', // font-semibold
        lineHeight: '1.45', // 약간의 여유를 둔 line-height
        margin: '0',
        padding: '5px 0', // 상하 패딩으로 높이 조정
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent',
        width: '100%',
        fontFamily: 'inherit',
    };

    const handleTitleClick = useCallback(
        (e: React.MouseEvent) => {
            // 링크를 클릭한 경우 편집 모드로 전환하지 않음
            if ((e.target as HTMLElement).tagName === 'A') {
                return;
            }

            setIsEditing(true);

            // 클릭한 위치에서 텍스트 내 커서 위치 계산
            if (titleDivRef.current && title) {
                const divElement = titleDivRef.current;
                let range: Range | null = null;

                // 크로스 브라우저 호환성 처리
                if (document.caretRangeFromPoint) {
                    range = document.caretRangeFromPoint(e.clientX, e.clientY);
                } else if (document.caretPositionFromPoint) {
                    const caretPos = document.caretPositionFromPoint(e.clientX, e.clientY);
                    if (caretPos) {
                        range = document.createRange();
                        range.setStart(caretPos.offsetNode, caretPos.offset);
                    }
                }

                if (range) {
                    let position = 0;

                    // Range의 startOffset을 이용해 클릭 위치의 텍스트 인덱스 계산
                    const walker = document.createTreeWalker(
                        divElement,
                        NodeFilter.SHOW_TEXT,
                        null
                    );

                    let node: Node | null;
                    while ((node = walker.nextNode())) {
                        if (node === range.startContainer) {
                            position += range.startOffset;
                            break;
                        } else if (node.textContent) {
                            position += node.textContent.length;
                        }
                    }

                    // title의 실제 길이와 비교하여 유효한 범위 내로 제한
                    setCursorPosition(Math.min(position, title.length));
                }
            }
        },
        [title]
    );

    const handleTitleBlur = useCallback(() => {
        setIsEditing(false);
        setCursorPosition(null);
    }, []);

    const handleTitleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            onTitleChange(e.target.value);
        },
        [onTitleChange]
    );

    // 편집 모드 전환 시 커서 위치 설정
    React.useEffect(() => {
        if (isEditing && textareaRef.current && cursorPosition !== null) {
            const textarea = textareaRef.current;
            // 다음 렌더링 사이클에서 커서 위치 설정
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorPosition, cursorPosition);
            }, 0);
        }
    }, [isEditing, cursorPosition]);

    if (isEditing) {
        return (
            <div className="bg-color" style={commonContainerStyle}>
                <TextareaAutosize
                    ref={textareaRef}
                    placeholder={placeholder}
                    value={title}
                    onChange={handleTitleChange}
                    onBlur={handleTitleBlur}
                    autoFocus={cursorPosition === null}
                    minRows={1}
                    maxLength={MAX_TEXT_LENGTH}
                    style={{
                        ...commonTextStyle,
                        resize: 'none',
                        overflow: 'hidden',
                    }}
                />
            </div>
        );
    }

    return (
        <div
            ref={titleDivRef}
            className="bg-color cursor-text hover:bg-opacity-80 break-words"
            style={commonContainerStyle}
            onClick={handleTitleClick}
        >
            <div style={commonTextStyle}>
                {title ? linkify(title) : <span className="text-gray-400">{placeholder}</span>}
            </div>
        </div>
    );
};
