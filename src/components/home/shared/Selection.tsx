import { selectionModeState, selectedItemsState } from '@/lib/jotai';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export function Selection() {
    const [selectionMode, setSelectionMode] = useAtom(selectionModeState);
    const [, setSelectedItems] = useAtom(selectedItemsState);

    const resetSelection = () => {
        setSelectionMode(false);
        setSelectedItems(new Set<string>());
    };

    const startSelection = () => {
        setSelectionMode(true);
        setSelectedItems(new Set<string>());
    };

    const handleToggleSelectionMode = () => {
        if (selectionMode) {
            resetSelection();
        } else {
            startSelection();
        }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            resetSelection();
        }
    };

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <Button
            size="small"
            variant="outlined"
            onClick={handleToggleSelectionMode}
            sx={{
                height: 25.6,
                minWidth: 'auto',
                width: 'auto',
                padding: '4px 8px',
                borderColor: 'var(--border-color)',
            }}
        >
            {selectionMode ? (
                <XCircleIcon className="w-4 h-4" style={{ color: 'var(--text-color)' }} />
            ) : (
                <CheckCircleIcon className="w-4 h-4" style={{ color: 'var(--text-color)' }} />
            )}
        </Button>
    );
}
