import { editorViewLogger } from '@/debug/editor';
import { formatDate, formatDateTime } from '@/functions/date';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { memo, useMemo, useRef, useState } from 'react';

type HeaderArea2Props = {
    titleComponent: React.ReactElement;
    time: number | null;
    actionBtnComponent: React.ReactNode;
    onDateChange?: (newDate: number) => void;
    canEditDate?: boolean;
};
export const HeaderAreaTemplate = memo(function HeaderAreaTemplate({
    titleComponent,
    time,
    actionBtnComponent,
    onDateChange,
    canEditDate,
}: HeaderArea2Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState('');
    const [localTime, setLocalTime] = useState<number | null>(null);

    // localTime이 있으면 우선 사용, 없으면 time 사용
    const displayTime = localTime ?? time;

    const dateValue = useMemo(() => {
        if (!displayTime) return '';
        const date = new Date(displayTime);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, [displayTime]);

    const handleDateClick = () => {
        if (canEditDate) {
            setTempValue(dateValue);
            setIsEditing(true);
        }
    };

    const handleConfirm = () => {
        if (tempValue && onDateChange && time) {
            // 날짜만 변경하고 원래 시간은 유지
            const originalDate = new Date(time);
            const [year, month, day] = tempValue.split('-').map(Number);
            const newDate = new Date(
                year,
                month - 1,
                day,
                originalDate.getHours(),
                originalDate.getMinutes(),
                originalDate.getSeconds(),
                originalDate.getMilliseconds()
            );
            if (!isNaN(newDate.getTime())) {
                // 즉시 UI에 반영
                setLocalTime(newDate.getTime());
                onDateChange(newDate.getTime());
            }
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setTempValue('');
    };

    return (
        <HeaderAreaRoot>
            <div className="min-h-[20px]">{titleComponent}</div>
            <div className="flex flex-wrap items-center justify-between w-full min-h-[32px] gap-x-4 gap-y-2">
                <div id="changeModeBtn" className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                    {actionBtnComponent}
                </div>
                <div className="flex items-center text-[12px] pt-[3px] flex-shrink-0 relative">
                    {/* 날짜 텍스트 - 레이아웃 유지를 위해 항상 렌더링 */}
                    <div
                        className={`!opacity-[.30] hover:!opacity-[1] ${canEditDate ? 'cursor-pointer' : ''} ${isEditing ? 'invisible' : ''}`}
                        onClick={handleDateClick}
                    >
                        {displayTime && (
                            <Tooltip title={formatDateTime(displayTime)} arrow>
                                <span>{formatDate(displayTime)}</span>
                            </Tooltip>
                        )}
                    </div>

                    {/* 편집 UI - absolute로 overlay */}
                    {isEditing && (
                        <div className="absolute right-0 top-0 flex items-center gap-1 bg-[var(--bg-color)] z-10">
                            <input
                                type="date"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                max={new Date().toISOString().slice(0, 10)}
                                autoFocus
                                className="text-[12px] px-1 py-0.5 border border-[var(--border-color)] rounded bg-[var(--bg-color)] text-[var(--text-color)] [color-scheme:var(--color-scheme)]"
                            />
                            <IconButton
                                size="small"
                                onClick={handleConfirm}
                                sx={{
                                    width: 20,
                                    height: 20,
                                    padding: 0,
                                    color: 'var(--text-color)',
                                }}
                            >
                                <CheckIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                            <IconButton
                                size="small"
                                onClick={handleCancel}
                                sx={{
                                    width: 20,
                                    height: 20,
                                    padding: 0,
                                    color: 'var(--text-color)',
                                }}
                            >
                                <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </div>
                    )}
                </div>
            </div>
        </HeaderAreaRoot>
    );
});

export function HeaderAreaRoot({ children }: { children?: React.ReactNode }) {
    return (
        <div
            id="header_area"
            className="mb-[14px] border-b-[1px] border-color-faint pb-[14px] px-[19px] min-h-[90px] "
        >
            {children}
        </div>
    );
}

export function HeaderAreaDummy() {
    return <HeaderAreaRoot></HeaderAreaRoot>;
}
