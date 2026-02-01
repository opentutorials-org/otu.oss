// CustomPrompt 컴포넌트: 사용자가 커스텀 프롬프트를 입력할 수 있도록 하는 컴포넌트입니다.
'use client';

import ExportButton from '@/components/common/button/ExportButton';
import { useEffect, useState } from 'react';
import s from '../style.module.css';
import { useLingui } from '@lingui/react/macro';
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
import { getUserLocale, setUserLocale } from '@/i18n-server';
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
    const { t } = useLingui();
    const [locale, setLocale] = useState<Locale>('en');
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const openSnackbar = useSetAtom(openSnackbarState);
    const supabase = createClient();

    // 언어별 기본 프롬프트 가져오기
    const defaultPicturePrompt = t`이미지의 초점이 문자라면 문자만 출력해주세요. 그렇지 않다면, 보이는 사물을 단어로 나열해주세요. 설명형 문장 사용 금지. 예: 컵, 꽃, 바다, 갈매기`;

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
                message: t`프롬프트가 저장되었습니다`,
                severity: 'info',
                autoHideDuration: 3000,
                horizontal: 'left',
                vertical: 'bottom',
            });
        } catch (error) {
            settingLogger('프롬프트 저장 실패:', error);
            openSnackbar({
                message: t`프롬프트 저장 중 오류가 발생했습니다`,
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
                <Typography>{t`사진 프롬프트`}</Typography>
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
                            {t`이미지 업로드 시 AI가 이미지를 분석해 정보를 제공합니다. 여기서 AI의 이미지 설명 방식을 설정할 수 있습니다.`}
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
                        <Button onClick={handleSavePrompt}>{t`적용`}</Button>
                    </div>
                </FormControl>
            </AccordionDetails>
        </Accordion>
    );
}
