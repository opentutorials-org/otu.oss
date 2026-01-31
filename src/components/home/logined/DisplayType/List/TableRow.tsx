import { convertDateFormat } from '@/functions/date';
import s from './style.module.css';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { CircleIcon } from '@/components/common/icons/CircleIcon';
import { getDisplayTitle } from '../../page/CreateUpdate/utils/textUtils';
import { FolderTag } from '@/components/common/FolderTag';
import { useTranslations } from 'next-intl';
import BellIcon from '@/public/icon/BellIcon';

interface TableRowProps {
    checked: boolean | null;
    item: {
        id: string;
        title: string;
        body: string;
        type: string;
        createdAt: string;
        folder_id?: string | null;
    };
    onSelect: (id: string, type: string) => void;
    isLast: boolean;
    hideFolderName?: boolean;
    hasAlarm?: boolean;
}

const TableRow: React.FC<TableRowProps> = ({
    checked,
    item,
    onSelect,
    isLast,
    hideFolderName = false,
    hasAlarm = false,
}) => {
    const t = useTranslations();
    const displayTitle = getDisplayTitle(item.title, item.body, 1000, t('common.no-title'));

    return (
        <tr
            className={`cursor-pointer hover-emphasis touch-hover-guard px-5 max-sm:px-4`}
            data-selected={checked || undefined}
            style={{
                display: 'grid',
                gridTemplateColumns: checked === null ? '1fr 45px' : '25px 1fr 45px',
                backgroundColor: checked ? 'var(--selection-color)' : undefined,
                transition: 'background-color 0.15s ease-out',
            }}
            onClick={() => {
                onSelect(item.id, item.type);
            }}
        >
            {checked === null ? null : (
                <td
                    className={`pr-1 cursor-pointer flex items-center ${
                        !isLast && 'border-b-[1px] border-color-faint box-border'
                    } py-4`}
                >
                    {checked ? (
                        <CheckCircleIcon
                            className="w-5 h-5"
                            style={{ color: 'var(--text-color)' }}
                        />
                    ) : (
                        <CircleIcon className="w-5 h-5" style={{ color: 'var(--text-color)' }} />
                    )}
                </td>
            )}
            <td
                className={`pr-1 cursor-pointer ${
                    !isLast && 'border-b-[1px] border-color-faint box-border'
                } py-4 ${!item.title || item.title.trim() === '' ? 'text-gray-500 italic' : ''}`}
            >
                <div className="flex flex-col gap-1 min-h-[20px]">
                    <div>
                        {hasAlarm && (
                            <div className="float-left focus-bg-color p-[3px] mr-[3px] rounded-full mt-[2px] inline">
                                <BellIcon width="14" height="14" className="text-color" />
                            </div>
                        )}
                        <FolderTag
                            folderId={item.folder_id}
                            hideFolderName={hideFolderName}
                            variant="list"
                            className="flex-shrink-0"
                        />

                        <span className="break-all overflow-wrap-anywhere leading-normal">
                            {displayTitle}
                        </span>
                    </div>
                </div>
            </td>
            <td
                className={`flex items-center text-[0.7rem] cursor-pointer ${
                    !isLast && 'border-b-[1px] border-color-faint box-border'
                } py-4`}
                style={{ color: 'var(--sub-text-color, rgba(0,0,0,0.5))' }}
            >
                {convertDateFormat(item.createdAt)}
            </td>
        </tr>
    );
};

export default TableRow;
