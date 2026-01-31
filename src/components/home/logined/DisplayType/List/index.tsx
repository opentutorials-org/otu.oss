import s from './style.module.css';
import TableRow from './TableRow';
import { selectedItemsState, selectionModeState, toggleItemSelection } from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import AddIcon from '@mui/icons-material/Add';
import { useTranslations } from 'next-intl';

type ContentListProps = {
    contents:
        | {
              id: string;
              title: string;
              body: string;
              createdAt: string;
              img_url: string;
              length: number;
              type: string;
              folder_id?: string | null;
          }[]
        | null;
    onSelect: (id: string, type: string) => void;
    hideFolderName?: boolean;
    onCreatePage?: () => void;
    isCreatingPage?: boolean;
    alarmStatuses?: Map<string, boolean>;
};

export default function List({
    contents,
    onSelect,
    hideFolderName = false,
    onCreatePage,
    isCreatingPage = false,
    alarmStatuses,
}: ContentListProps) {
    const [selectedItems, setSelectedItems] = useAtom(selectedItemsState);
    const [selectionMode, setSelectionMode] = useAtom(selectionModeState);
    const toggleSelection = useSetAtom(toggleItemSelection);
    const t = useTranslations('common');
    const tFolder = useTranslations('folder');

    if (!contents) {
        return null;
    }

    return (
        <div className="w-full border-color border-[1px] rounded-[3px] overflow-hidden">
            <table className="w-full">
                <tbody>
                    {/* 페이지 생성 행 - 폴더 디테일 페이지에서만 표시 */}
                    {onCreatePage && (
                        <tr
                            className="border-b-[0.5px] border-color-faint cursor-pointer hover:bg-[var(--focus-bg-color)] transition-colors duration-100 px-5 max-sm:px-4"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: selectionMode ? '25px 1fr 45px' : '1fr 45px',
                            }}
                            onClick={onCreatePage}
                        >
                            {selectionMode && (
                                <td className="pr-1 cursor-pointer flex items-center py-4">
                                    {/* 빈 공간 */}
                                </td>
                            )}
                            <td className="pr-1 cursor-pointer py-4">
                                <div className="flex items-center justify-center gap-2">
                                    {isCreatingPage ? (
                                        <div className="animate-spin text-xl">⏳</div>
                                    ) : (
                                        <>
                                            <AddIcon
                                                sx={{ fontSize: 24, color: 'var(--text-color)' }}
                                            />
                                        </>
                                    )}
                                </div>
                            </td>
                            <td className="flex items-center cursor-pointer py-4">
                                {/* 빈 공간 */}
                            </td>
                        </tr>
                    )}

                    {contents.map((item, index) => {
                        const isLastContent = contents.length === index + 1;
                        const isLast = isLastContent; // 마지막 콘텐츠 항목에는 항상 구분선 없음

                        return (
                            <TableRow
                                key={item.id}
                                checked={selectionMode ? selectedItems.has(item.id) : null}
                                item={item}
                                isLast={isLast}
                                onSelect={(id, type) => {
                                    if (selectionMode) {
                                        toggleSelection(id);
                                    } else {
                                        onSelect(id, type);
                                    }
                                }}
                                hideFolderName={hideFolderName}
                                hasAlarm={alarmStatuses?.get(item.id) || false}
                            />
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
