'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { Bars3Icon, RectangleGroupIcon } from '@heroicons/react/24/outline';
import { useAtom } from 'jotai';
import { displayModeState } from '@/lib/jotai';
import { useCallback } from 'react';
import { requestHapticFeedback } from '@/utils/hapticFeedback';

export default function ListType() {
    const [displayMode, setDisplayMode] = useAtom(displayModeState);

    const handleDisplayModeChange = useCallback(
        (event: React.MouseEvent<HTMLElement>, newAlignment: 'GRID' | 'LIST' | null) => {
            if (newAlignment !== null) {
                setDisplayMode(newAlignment);
            }
            requestHapticFeedback();
        },
        [setDisplayMode]
    );

    return (
        <ToggleButtonGroup
            size="small"
            exclusive
            value={displayMode}
            onChange={handleDisplayModeChange}
        >
            <ToggleButton value="GRID">
                <RectangleGroupIcon className="w-7 h-7" />
            </ToggleButton>
            <ToggleButton value="LIST">
                <Bars3Icon className="w-7 h-7" />
            </ToggleButton>
        </ToggleButtonGroup>
    );
}
