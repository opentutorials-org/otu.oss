// CustomPrompt 컴포넌트: 사용자가 커스텀 프롬프트를 입력할 수 있도록 하는 컴포넌트입니다.
'use client';

import ExportButton from '@/components/common/button/ExportButton';
import { useEffect, useState } from 'react';
import s from '../style.module.css';
import { useTranslations } from 'next-intl';
import {
    FormControl,
    TextField,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Button,
    Snackbar,
    Alert,
    Box,
} from '@mui/material';
import { getUserLocale, setUserLocale } from '@/i18n';
import { Locale } from '@/functions/constants';
import { getClientLocale, setClientLocale } from '@/functions/cookie';
import { useRouter } from 'next/navigation';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createClient } from '@/supabase/utils/client';
import { useSetAtom } from 'jotai';
import { openSnackbarState } from '@/lib/jotai';
import Photo from '@/public/icon/bottom_nav_photo';
import { settingLogger } from '@/debug/setting';

export default function CustomPrompt() {
    const router = useRouter();
    const t = useTranslations('setting.custom-prompt');
    const commonT = useTranslations('common');
    const [locale, setLocale] = useState<Locale>('en');
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const openSnackbar = useSetAtom(openSnackbarState);
    const supabase = createClient();

    // 언어별 기본 프롬프트 가져오기
    const defaultPicturePrompt = t('default-picture-prompt');

    // 커스텀 프롬프트 변경 핸들러
    const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setCustomPrompt(event.target.value);
    };

    // 커스텀 프롬프트 저장 핸들러를 수정
    const handleSavePrompt = async () => {
        settingLogger('프롬프트 저장 시도:', customPrompt);
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;

            const { data, error } = await supabase
                .from('custom_prompts')
                .upsert({
                    user_id: userData.user.id,
                    photo_prompt: customPrompt,
                    updated_at: new Date().toISOString(),
                })
                .select();

            if (error) throw error;

            settingLogger('프롬프트 저장 성공:', data);
            openSnackbar({
                message: t('prompt-saved'),
                severity: 'info',
                autoHideDuration: 3000,
                horizontal: 'left',
                vertical: 'bottom',
            });
        } catch (error) {
            settingLogger('프롬프트 저장 실패:', error);
            openSnackbar({
                message: t('error-saving-prompt'),
                severity: 'error',
                autoHideDuration: 3000,
                horizontal: 'left',
                vertical: 'bottom',
            });
        }
    };

    //컴포넌트 마운트 시 사용자 언어 설정을 가져옴
    useEffect(() => {
        (async () => {
            let locale: Locale;
            if (isOnline) {
                locale = (await getUserLocale()) || 'en';
            } else {
                locale = getClientLocale() || 'en';
            }
            setLocale(locale);
        })();
    }, []);

    // 컴포넌트 마운트 시 기존 프롬프트 불러오기
    useEffect(() => {
        const loadPrompt = async () => {
            try {
                const { data: userData } = await supabase.auth.getUser();
                if (!userData.user) {
                    setCustomPrompt(defaultPicturePrompt);
                    return;
                }

                const { data, error } = await supabase
                    .from('custom_prompts')
                    .select('photo_prompt')
                    .eq('user_id', userData.user.id);

                if (error) {
                    throw error;
                }

                // 데이터가 있으면 첫 번째 결과 사용, 없으면 기본값 사용
                if (data && data.length > 0) {
                    setCustomPrompt(data[0].photo_prompt || defaultPicturePrompt);
                } else {
                    setCustomPrompt(defaultPicturePrompt);
                }
            } catch (error) {
                settingLogger('Error loading prompt:', error);
                setCustomPrompt(defaultPicturePrompt);
            }
        };

        loadPrompt();
    }, [defaultPicturePrompt]);

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t('title')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <FormControl fullWidth>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                        <Photo
                            width="24"
                            height="24"
                            className="fill-text-color stroke-text-color"
                        />
                        <Typography variant="body2" sx={{ flex: 1 }}>
                            {t('photo-prompt-description')}
                        </Typography>
                    </Box>
                    <TextField
                        value={customPrompt}
                        onChange={handlePromptChange}
                        placeholder={defaultPicturePrompt}
                        multiline
                        rows={4}
                        variant="outlined"
                    />
                    <div className="text-center mt-4">
                        <Button onClick={handleSavePrompt}>{commonT('apply')}</Button>
                    </div>
                </FormControl>
            </AccordionDetails>
        </Accordion>
    );
}
