import { openConfirmState } from '@/lib/jotai';
import Button from '@mui/material/Button';
import { useSetAtom } from 'jotai/index';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useTranslations } from 'next-intl';
function getCurDatetime() {
    const now = new Date();

    return (
        now.getFullYear() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        '_' +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0')
    );
}

export default function AsyncCSV() {
    const openConfirm = useSetAtom(openConfirmState);
    const t = useTranslations('setting');

    async function downloadCSV() {
        openConfirm({
            message: t('confirm-download-json'),
            onNo: () => {},
            noLabel: t('cancel'),
            yesLabel: t('download'),
            onYes: async () => {
                try {
                    const res = await fetch('/api/setting/export');
                    const data = await res.json();

                    if (data.message === 'success') {
                        if (data.data.length === 0) {
                            openConfirm({
                                message: t('no-data-to-download'),
                                onYes: () => {},
                                yesLabel: t('confirm'),
                            });
                            return;
                        }

                        const datetimeStr = getCurDatetime();
                        const filename = `OTU_AI_${datetimeStr}`;
                        const blob = new Blob([`\ufeff${JSON.stringify(data.data)}`], {
                            type: 'text/json',
                        });

                        const zip = new JSZip();
                        zip.file('page.json', blob);
                        zip.generateAsync({ type: 'blob' }).then(function (content) {
                            const zipFilename = `${filename}.zip`;
                            saveAs(content, zipFilename);
                        });
                    } else {
                        openConfirm({
                            message: t('failed-to-fetch-data'),
                            onYes: () => {},
                            yesLabel: t('confirm'),
                        });
                    }
                } catch (e: any) {
                    openConfirm({
                        message: t('critical-error-contact-admin'),
                        onYes: () => {},
                        yesLabel: t('confirm'),
                    });
                }
            },
        });
    }

    return (
        <Button variant="contained" onClick={downloadCSV} color="primary">
            {t('download')}
        </Button>
    );
}
