import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { DocumentIcon, FolderOpenIcon, BellIcon } from '@heroicons/react/24/outline';
import { requestHapticFeedback } from '@/utils/hapticFeedback';
import { navPageLogger } from '@/debug/nav';
import { useEffect, useState } from 'react';
import { checkIsSuperuser } from '@/functions/checkSuperuser';

export default function ContentTypeSwitcher() {
    const { t } = useLingui();
    const navigate = useNavigate();
    const location = useLocation();
    const [isSuperuser, setIsSuperuser] = useState<boolean>(false);

    // 슈퍼유저 체크
    useEffect(function checkSuperuserStatus() {
        const checkStatus = async () => {
            const isSuper = await checkIsSuperuser();
            setIsSuperuser(isSuper);
        };
        checkStatus();
    }, []);

    const pathname = location.pathname || '';
    const isReminder = pathname === '/reminder' || pathname.startsWith('/reminder/');
    const isFolder = pathname === '/folder' || pathname.startsWith('/folder/');
    const currentValue: 'page' | 'folder' | 'reminder' = isReminder
        ? 'reminder'
        : isFolder
          ? 'folder'
          : 'page';

    function handleChange(
        event: React.MouseEvent<HTMLElement>,
        newMode: 'page' | 'folder' | 'reminder' | null
    ) {
        if (newMode === null) return;

        navPageLogger('view toggle: start', { from: currentValue, to: newMode, pathname });

        if (newMode === 'folder') {
            navigate('/folder');
        } else if (newMode === 'reminder') {
            navigate('/reminder');
        } else {
            navigate('/page');
        }

        requestHapticFeedback();
        navPageLogger('view toggle: end', { to: newMode });
    }

    return (
        <ToggleButtonGroup size="small" exclusive value={currentValue} onChange={handleChange}>
            <ToggleButton value="page" title={t`페이지`}>
                <DocumentIcon className="w-7 h-7" />
            </ToggleButton>
            <ToggleButton value="folder" title={t`폴더`}>
                <FolderOpenIcon className="w-7 h-7" />
            </ToggleButton>
            {/* 리마인더는 슈퍼유저에게만 표시 */}
            {isSuperuser && (
                <ToggleButton value="reminder" title={t`리마인더`}>
                    <BellIcon className="w-7 h-7" />
                </ToggleButton>
            )}
        </ToggleButtonGroup>
    );
}
