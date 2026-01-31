import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSetAtom } from 'jotai';
import { chatOpenState } from '@/lib/jotai';
import { useTranslations } from 'next-intl';
import { withButtonMotion } from '@/components/common/withMotionEffects';
import Ai from '@/public/icon/bottom_nav_ai';

// 저장 버튼 컴포넌트 (Motion 효과 제외)
const SaveButtonComponent = ({
    onSubmit,
    saveShortcutText,
    getSaveStatusIcon,
    getSaveStatusText,
    isModified,
    tEditor,
}: {
    onSubmit: () => void;
    saveShortcutText: string;
    getSaveStatusIcon: () => React.ReactElement | undefined;
    getSaveStatusText: () => string;
    isModified: boolean;
    tEditor: any;
}) => (
    <Tooltip arrow title={`${saveShortcutText} - ${tEditor('manual-save')}`}>
        <span>
            <Chip
                icon={getSaveStatusIcon()}
                label={getSaveStatusText()}
                variant={isModified ? 'outlined' : 'filled'}
                color="default"
                size="small"
                onClick={onSubmit}
                clickable={true}
                className="click-animation"
                sx={{
                    borderRadius: '50px',
                    fontSize: '0.75rem',
                    height: '32px',
                    cursor: 'pointer',
                    '&:hover': {
                        opacity: 1,
                    },
                    '&.MuiChip-root': {
                        backgroundColor: 'var(--focus-bg-color)',
                    },
                    '&.MuiChip-icon': {
                        color: 'var(--text-color)',
                        display: 'none',
                    },
                    color: 'var(--text-color) !important',
                }}
            />
        </span>
    </Tooltip>
);

// 채팅 버튼 컴포넌트 (Motion 효과 제외)
const ChatButtonComponent = ({
    setChatOpen,
    tNavigation,
}: {
    setChatOpen: (updater: (prev: boolean) => boolean) => void;
    tNavigation: any;
}) => (
    <Tooltip arrow title={tNavigation('chat')}>
        <span>
            <Chip
                icon={<Ai width="16" height="16" className="fill-text-color stroke-text-color" />}
                label=""
                variant="filled"
                color="default"
                size="small"
                onClick={() => setChatOpen((prev) => !prev)}
                clickable={true}
                className="click-animation"
                sx={{
                    borderRadius: '50%',
                    fontSize: '0.75rem',
                    minWidth: '32px',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '& .MuiChip-icon': {
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                    '& .MuiChip-label': {
                        display: 'none',
                    },
                    '&:hover': {
                        opacity: 1,
                    },
                    '&.MuiChip-root': {
                        backgroundColor: 'var(--focus-bg-color)',
                    },
                }}
            />
        </span>
    </Tooltip>
);

// Motion 효과가 적용된 버튼들
const SaveButton = withButtonMotion(SaveButtonComponent);
const ChatButton = withButtonMotion(ChatButtonComponent);

type EditorControlsProps = {
    onSubmit: () => void;
    saveShortcutText: string;
    isModified: boolean;
    isAutoSaving: boolean;
    bodyLength: number;
    title: string;
};

/**
 * 에디터 하단 컨트롤 버튼들 (저장, AI 채팅)
 */
export function EditorControls({
    onSubmit,
    saveShortcutText,
    isModified,
    isAutoSaving,
    bodyLength,
    title,
}: EditorControlsProps) {
    const setChatOpen = useSetAtom(chatOpenState);
    const tEditor = useTranslations('editor');
    const tNavigation = useTranslations('navigation');

    const getSaveStatusText = () => {
        if (isAutoSaving) return tEditor('saving');
        if (isModified) return tEditor('unsaved');
        return tEditor('saved');
    };

    const getSaveStatusIcon = () => {
        if (isAutoSaving) return <CircularProgress size={16} thickness={4} />;
        if (isModified) return undefined;
        return <CheckCircleIcon fontSize="small" sx={{ color: 'var(--text-color) !important' }} />;
    };

    const showSaveButton = bodyLength > 0 || isModified || (title && title.trim() !== '');

    return (
        <div className="flex items-center gap-2">
            {showSaveButton && (
                <SaveButton
                    id="editor-save-button"
                    onSubmit={onSubmit}
                    saveShortcutText={saveShortcutText}
                    getSaveStatusIcon={getSaveStatusIcon}
                    getSaveStatusText={getSaveStatusText}
                    isModified={isModified}
                    tEditor={tEditor}
                />
            )}

            {/* AI 채팅 버튼 - 항상 표시하지만 key를 통해 리마운트 */}
            <ChatButton
                key={`chat-${showSaveButton ? 'active' : 'inactive'}`}
                setChatOpen={setChatOpen}
                tNavigation={tNavigation}
            />
        </div>
    );
}
