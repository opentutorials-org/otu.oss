'use client';
import { useEffect, useState } from 'react';
import Checkbox from '@mui/material/Checkbox';
import { DocsDialog } from './docs/docDialog';
import { termsOfService } from './docs/terms-of-service_2024_6_20';
import { privacyPolicy } from './docs/privacy-policy_2024_6_20';
import { marketing } from './docs/marketing_2024_6_20';
import { useTranslations } from 'next-intl';

export type docs = {
    title: string;
    body: string;
    version: string;
};
export type agreementType = {
    termsOfService: { version: string | null };
    privacyPolicy: { version: string | null };
    marketing: { version: string | null };
};
type AgreementFormProps = {
    onChange: (agreements: any) => void;
    agreements: agreementType;
};
export const AgreementForm = ({ onChange, agreements }: AgreementFormProps) => {
    const t = useTranslations('agreement-form');
    const [docInfo, setDocInfo] = useState<docs & { open: boolean }>({
        open: false,
        title: '',
        body: '',
        version: '',
    });
    const [_agreements, setAgreements] = useState(agreements);

    useEffect(() => {
        // 최초 렌더링 시 부모 컴포넌트로 ��태 전달
        onChange(_agreements);
    }, []);

    useEffect(() => {
        setAgreements(agreements);
    }, [agreements]);

    const handleChange = (e: { target: { name: any; checked: any } }) => {
        const { name, checked, value } = e.target as HTMLInputElement;
        const updatedAgreements = {
            ..._agreements,
            [name]: { version: checked ? value : null },
        };

        setAgreements(updatedAgreements);
        // 각 체크 박스가 변경될 때마다 부모 컴포넌트로 상태 전달
        onChange(updatedAgreements);
    };

    return (
        <div className="w-full text-[17px]">
            <div>
                <label>
                    <Checkbox
                        name="termsOfService"
                        checked={_agreements.termsOfService.version !== null}
                        onChange={handleChange}
                        value={termsOfService.version}
                        required
                        className="mr-1"
                    />
                    <a
                        href="#"
                        className="cursor-pointer underline"
                        onClick={() => {
                            setDocInfo({
                                open: true,
                                title: termsOfService.title,
                                body: termsOfService.body,
                                version: termsOfService.version,
                            });
                        }}
                    >
                        {t('terms-of-service')}
                    </a>{' '}
                    {t('required')}
                </label>
            </div>
            <div className="mt-1">
                <label>
                    <Checkbox
                        name="privacyPolicy"
                        checked={_agreements.privacyPolicy.version !== null}
                        onChange={handleChange}
                        value={privacyPolicy.version}
                        required
                        className="mr-1"
                    />
                    <a
                        href="#"
                        className="cursor-pointer underline"
                        onClick={() => {
                            setDocInfo({
                                open: true,
                                title: privacyPolicy.title,
                                body: privacyPolicy.body,
                                version: privacyPolicy.version,
                            });
                        }}
                    >
                        {t('privacy-policy')}
                    </a>{' '}
                    {t('required')}
                </label>
            </div>
            <div className="mt-1">
                <label>
                    <Checkbox
                        name="marketing"
                        checked={_agreements.marketing.version !== null}
                        onChange={handleChange}
                        value={marketing.version}
                        className="mr-1"
                    />
                    <a
                        href="#"
                        className="cursor-pointer underline"
                        onClick={() => {
                            setDocInfo({
                                open: true,
                                title: marketing.title,
                                body: marketing.body,
                                version: marketing.version,
                            });
                        }}
                    >
                        {t('marketing-consent')}
                    </a>{' '}
                    {t('optional')}
                </label>
            </div>

            <DocsDialog
                title={docInfo.title}
                body={docInfo.body}
                open={docInfo.open}
                onClose={() => {
                    setDocInfo({ ...docInfo, open: false });
                }}
            />
        </div>
    );
};
export default AgreementForm;
