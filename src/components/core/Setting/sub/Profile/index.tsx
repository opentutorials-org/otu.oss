'use client';

import { useAtom } from 'jotai';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState, useRef } from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Button,
    TextField,
    Box,
    Avatar,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FileUploaderRegular, UploadCtxProvider } from '@uploadcare/react-uploader';
import '@uploadcare/react-uploader/core.css';
import { createClient } from '@/supabase/utils/client';
import { openSnackbarState, profileDialogState, profileUpdateState } from '@/lib/jotai';
import { useSetAtom } from 'jotai';
import s from '../style.module.css';
import { PROFILE_IMAGE_SIZE } from '@/functions/constants';
import { profileLogger } from '@/debug/profile';

// 주요 타임존 목록
const TIMEZONE_OPTIONS = [
    { value: 'Asia/Seoul', label: 'Asia/Seoul (KST, UTC+9)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST, UTC+8)' },
    { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (HKT, UTC+8)' },
    { value: 'Asia/Taipei', label: 'Asia/Taipei (TST, UTC+8)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT, UTC+7)' },
    { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB, UTC+7)' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+0/+1)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST, UTC+1/+2)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST, UTC+1/+2)' },
    { value: 'Europe/Rome', label: 'Europe/Rome (CET/CEST, UTC+1/+2)' },
    { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK, UTC+3)' },
    { value: 'America/New_York', label: 'America/New York (EST/EDT, UTC-5/-4)' },
    { value: 'America/Chicago', label: 'America/Chicago (CST/CDT, UTC-6/-5)' },
    { value: 'America/Denver', label: 'America/Denver (MST/MDT, UTC-7/-6)' },
    { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT, UTC-8/-7)' },
    { value: 'America/Sao_Paulo', label: 'America/São Paulo (BRT, UTC-3)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT/AEST, UTC+11/+10)' },
    { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEDT/AEST, UTC+11/+10)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZDT/NZST, UTC+13/+12)' },
];

// 타임존 오프셋 구하는 함수
function getTimezoneOffsetString(timeZone: string) {
    try {
        const now = new Date();
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
        });
        const parts = dtf.formatToParts(now);
        const tzName = parts.find((p) => p.type === 'timeZoneName')?.value;
        // tzName이 'GMT+2' 또는 'UTC+2' 등일 수 있음
        return tzName?.replace('GMT', 'UTC') || '';
    } catch {
        return '';
    }
}

export default function Profile() {
    const { t } = useLingui();
    const [nickname, setNickname] = useState('');
    const [profileImage, setProfileImage] = useState('');
    const [timezone, setTimezone] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [timezoneOptions, setTimezoneOptions] = useState(TIMEZONE_OPTIONS);
    const supabase = createClient();
    const openSnackbar = useSetAtom(openSnackbarState);
    const uploaderRef = useRef<InstanceType<typeof UploadCtxProvider> | null>(null);
    const [profileDialog, setProfileDialog] = useAtom(profileDialogState);
    const [meta, setMeta] = useState<Record<string, string>>({});
    const setProfileUpdate = useSetAtom(profileUpdateState);

    // 타임존 옵션에 DB에 저장된 타임존이 없는 경우 추가하는 함수
    const addCustomTimezoneIfNeeded = (dbTimezone: string) => {
        if (!dbTimezone) return;

        const exists = timezoneOptions.some((option) => option.value === dbTimezone);
        if (!exists) {
            const offset = getTimezoneOffsetString(dbTimezone);
            const customOption = {
                value: dbTimezone,
                label: offset ? `${dbTimezone} (${offset})` : `${dbTimezone} (Custom)`,
            };
            setTimezoneOptions((prev) => [...prev, customOption]);
            profileLogger('커스텀 타임존 옵션 추가', { timezone: dbTimezone, offset });
        }
    };

    // 프로필 정보 로드
    const loadProfile = async () => {
        try {
            setIsLoading(true);

            // 현재 사용자 정보 먼저 가져오기
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                profileLogger('사용자 정보 없음');
                return;
            }

            // 프로필 정보 조회 (한 번에 모든 필드)
            const { data: profile, error } = await supabase
                .from('user_info')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                profileLogger('user_info 조회 오류', { error: error.message, userId: user.id });
                throw error;
            }

            // 프로필 정보가 있는 경우
            if (profile) {
                setNickname(profile.nickname || '');
                setProfileImage(profile.profile_img_url || '');

                // timezone이 없으면 자동 감지하여 설정
                if (!profile.timezone) {
                    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                    profileLogger('user_info timezone 자동 설정 필요', {
                        userId: user.id.substring(0, 8) + '...',
                        currentTimezone,
                        existingProfile: true,
                    });

                    // timezone 업데이트
                    const { error: updateError } = await supabase
                        .from('user_info')
                        .update({ timezone: currentTimezone })
                        .eq('user_id', user.id);

                    if (updateError) {
                        profileLogger('user_info timezone 자동 설정 실패', {
                            error: updateError.message,
                            userId: user.id.substring(0, 8) + '...',
                        });
                        setTimezone(currentTimezone); // 실패해도 UI에는 감지된 timezone 사용
                    } else {
                        profileLogger('user_info timezone 자동 설정 성공', {
                            userId: user.id.substring(0, 8) + '...',
                            timezone: currentTimezone,
                        });
                        setTimezone(currentTimezone);
                    }
                } else {
                    profileLogger('user_info timezone 이미 설정됨', {
                        userId: user.id.substring(0, 8) + '...',
                        timezone: profile.timezone,
                    });
                    setTimezone(profile.timezone);
                    // DB에 저장된 타임존이 기본 목록에 없는 경우 추가
                    addCustomTimezoneIfNeeded(profile.timezone);
                }
            } else {
                // 프로필이 없는 경우 새로 생성하고 timezone도 함께 설정
                const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                profileLogger('user_info 없음, 새로 생성 및 timezone 자동 설정', {
                    userId: user.id.substring(0, 8) + '...',
                    currentTimezone,
                });

                const { error: insertError } = await supabase.from('user_info').insert({
                    user_id: user.id,
                    timezone: currentTimezone,
                });

                if (insertError) {
                    profileLogger('user_info 생성 및 timezone 설정 실패', {
                        error: insertError.message,
                        userId: user.id.substring(0, 8) + '...',
                    });
                } else {
                    profileLogger('user_info 생성 및 timezone 설정 성공', {
                        userId: user.id.substring(0, 8) + '...',
                        timezone: currentTimezone,
                    });
                }

                // UI에는 기본값들과 감지된 timezone 설정
                setNickname('');
                setProfileImage('');
                setTimezone(currentTimezone);
            }

            // 메타 정보 설정
            setMeta({
                user_id: user.id,
                type: 'profile',
            });

            profileLogger('프로필 로드 완료', {
                userId: user.id.substring(0, 8) + '...',
                hasProfile: !!profile,
                timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
        } catch (error) {
            console.error('Profile error:', error);
            console.error('Error loading profile:', error);
            // 에러 발생 시에도 기본 타임존 설정
            setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        } finally {
            setIsLoading(false);
        }
    };

    // 프로필 저장
    const handleSave = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from('user_info').upsert(
                {
                    user_id: user.id,
                    nickname,
                    profile_img_url: profileImage,
                    timezone,
                },
                {
                    onConflict: 'user_id',
                }
            );

            if (error) throw error;

            setProfileUpdate((prev) => prev + 1); // 프로필 업데이트 상태 변경

            profileLogger('프로필 저장 완료', {
                nickname,
                timezone,
                hasProfileImage: !!profileImage,
            });

            openSnackbar({
                message: t`프로필이 저장되었습니다`,
                severity: 'info',
                autoHideDuration: 3000,
                horizontal: 'left',
                vertical: 'bottom',
            });
        } catch (error) {
            console.error('Profile error:', error);
            console.error('Error saving profile:', error);
        }
    };

    // 이미지 업로드 완료 후 처리
    const handleDone = (e: any) => {
        if (e.allEntries && e.allEntries.length > 0) {
            const file = e.allEntries[0];
            setProfileImage(file.cdnUrl || '');

            // 업로더 UI 초기화
            uploaderRef.current?.getAPI().removeAllFiles();
        }
    };

    // 아코디언 확장 시 프로필 정보 로드
    useEffect(() => {
        if (profileDialog.open) {
            loadProfile();
        }
    }, [profileDialog.open]);

    return (
        <Accordion
            expanded={profileDialog.open}
            onChange={() => setProfileDialog((prev) => ({ ...prev, open: !prev.open }))}
        >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t`프로필`}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                {isLoading ? (
                    <Typography>{t`로딩 중...`}</Typography>
                ) : (
                    <div className={`${s.root}`}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <TextField
                                fullWidth
                                label={t`닉네임`}
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                            />

                            <Box>
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                    {t`타임존`}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {t`설정된 시간대 기준 밤 10시~아침 7시에는 리마인더 알람이 발송되지 않습니다`}
                                </Typography>

                                <FormControl fullWidth sx={{ mb: 2 }}>
                                    <InputLabel id="timezone-select-label">
                                        {t`타임존을 선택하세요`}
                                    </InputLabel>
                                    <Select
                                        labelId="timezone-select-label"
                                        id="timezone-select"
                                        value={timezone}
                                        label={t`타임존을 선택하세요`}
                                        onChange={(e) => setTimezone(e.target.value)}
                                    >
                                        {timezoneOptions.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>

                            <Box>
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                    {t`프로필 이미지`}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    {t`권장 크기: ${PROFILE_IMAGE_SIZE.width}×${PROFILE_IMAGE_SIZE.height}`}
                                </Typography>

                                {profileImage && (
                                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                                        <Avatar
                                            src={profileImage}
                                            alt={nickname || t`프로필 이미지`}
                                            sx={{
                                                width: PROFILE_IMAGE_SIZE.width / 2,
                                                height: PROFILE_IMAGE_SIZE.height / 2,
                                                // 내부 img 태그에 명시적인 크기 설정으로 CLS 방지
                                                '& img': {
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                },
                                            }}
                                            imgProps={{
                                                // 내부 img 태그에 명시적인 width/height 속성 추가로 CLS 방지
                                                width: PROFILE_IMAGE_SIZE.width / 2,
                                                height: PROFILE_IMAGE_SIZE.height / 2,
                                                loading: 'lazy',
                                            }}
                                        />
                                    </Box>
                                )}

                                <FileUploaderRegular
                                    className="justify-center flex"
                                    ctxName="profileUploaderCtx"
                                    apiRef={uploaderRef}
                                    pubkey={process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY || ''}
                                    onDoneClick={handleDone}
                                    sourceList="local, camera"
                                    image-shrink={`${PROFILE_IMAGE_SIZE.width}x${PROFILE_IMAGE_SIZE.height}`}
                                    metadata={meta}
                                />
                            </Box>
                        </Box>
                    </div>
                )}
                <div className="text-center mt-4">
                    <Button onClick={handleSave}>{t`적용`}</Button>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
