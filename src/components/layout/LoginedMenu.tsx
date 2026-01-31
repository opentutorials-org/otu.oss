'use client';
import Fade from '@mui/material/Fade';
import Menu from '@mui/material/Menu';
import {
    openConfirmState,
    settingState,
    loginedMenuAnchorState,
    themeModeState,
} from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { createClient, fetchUserId } from '@/supabase/utils/client';
import { clearStorage } from '@/functions/clearStorage';
import { useLocale, useTranslations } from 'next-intl';
import { Database } from '@/lib/database/types';
import { addBreadcrumb } from '@sentry/nextjs';
import { isReactNativeWebView } from '@/functions/detectEnvironment';
import { communicateWithAppsWithCallback } from '../core/WebViewCommunicator';
import { menuLogger } from '@/debug/menu';
import { themeLogger } from '@/debug/theme';

import { useNavigate } from 'react-router-dom';

type LoginedMenuPropsType = {
    onClose: () => void;
};

export function LoginedMenu({ onClose }: LoginedMenuPropsType) {
    const router = useRouter();
    const pathname = usePathname();
    const [themeMode, setThemeMode] = useAtom(themeModeState);
    const [user, setUser] = useState<User | null>(null);
    const openConfirm = useSetAtom(openConfirmState);
    const [usageInfo, setUsageInfo] = useState<Database['public']['Tables']['usage']['Row'] | null>(
        null
    );
    const [userInfo, setUserInfo] = useState<
        Database['public']['Tables']['user_info']['Row'] | null
    >(null);
    const setSetting = useSetAtom(settingState);
    const t = useTranslations('loggedin-menu');
    const loginedMenuAnchor = useAtomValue(loginedMenuAnchorState);
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const [isWebView, setIsWebView] = useState<boolean | null>(true);
    const locale = useLocale();
    const [profileClickCount, setProfileClickCount] = useState(0);
    const profileClickTimer = useRef<NodeJS.Timeout | null>(null);
    const navigate = useNavigate();

    useEffect(function detectWebviewEnvironment() {
        if (typeof window !== 'undefined') {
            setIsWebView(isReactNativeWebView());
        }
    }, []);

    useEffect(
        function hydrateSupabaseSession() {
            if (!loginedMenuAnchor) return;

            const supabase = createClient();
            supabase.auth.getSession().then((result) => {
                if (result?.data?.session?.user) {
                    // @ts-ignore
                    setUser(result.data.session.user);
                }
            });
        },
        [loginedMenuAnchor]
    );
    const open = Boolean(loginedMenuAnchor);

    function applyTheme(nextTheme: 'gray' | 'white' | 'black') {
        const prev = themeMode;
        if (prev === nextTheme) return;
        themeLogger('toggle:start', { prev, next: nextTheme });
        setThemeMode(nextTheme);
        // themeMode가 localStorage에 저장되면 사용자 선택으로 간주됨 (atomWithStorage가 자동 저장)
        themeLogger('toggle:end', { current: nextTheme });
    }

    useEffect(
        function fetchUsageAndProfile() {
            if (!open) return;

            let isCancelled = false;

            const fetchUsage = async () => {
                try {
                    const supabase = createClient();
                    const userId = await fetchUserId('LoginedMenu.fetchUsage');
                    const { data: usageData, error: usageError } = await supabase
                        .from('usage')
                        .select('*')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (usageError) {
                        menuLogger('usage fetch error', usageError);
                        addBreadcrumb({
                            category: 'usage',
                            level: 'error',
                            message: 'usage 데이터 조회 실패',
                            data: { error: usageError },
                        });
                    }

                    if (!isCancelled) {
                        setUsageInfo(usageData ?? null);
                    }

                    const { data: userInfoData, error: userInfoError } = await supabase
                        .from('user_info')
                        .select('*')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (userInfoError) {
                        menuLogger('user_info fetch error', userInfoError);
                        addBreadcrumb({
                            category: 'usage',
                            level: 'error',
                            message: 'user_info 데이터 조회 실패',
                            data: { error: userInfoError },
                        });
                    }

                    if (!isCancelled) {
                        setUserInfo(userInfoData ?? null);
                    }
                } catch (error) {
                    menuLogger('fetchUsage fatal error', error);
                    addBreadcrumb({
                        category: 'usage',
                        level: 'error',
                        message: '로그인 메뉴 데이터 로딩 실패',
                        data: { error },
                    });
                }
            };

            fetchUsage();

            return () => {
                isCancelled = true;
            };
        },
        [open]
    );

    useEffect(
        function handleMenuOpenClose() {
            if (open) {
                // 메뉴가 열릴 때 스크롤 방지만 적용
                document.body.style.overflow = 'hidden';
            }

            // 메뉴가 닫힐 때 원래대로 복구
            return () => {
                document.body.style.overflow = '';
            };
        },
        [open]
    );

    if (!user) return <></>;

    const handleLogout = async () => {
        const supabase = createClient();
        const session = await supabase.auth.getSession();
        menuLogger(`session:`, JSON.stringify(session));

        // 기존 코드 변경: provider_id를 사용하여 identities 배열에서 provider 찾기
        let provider = null;
        const providerId = session.data.session?.user.user_metadata.provider_id;
        if (providerId && session.data.session?.user.identities) {
            const matchedIdentity = session.data.session.user.identities.find(
                (identity) => identity.id === providerId
            );
            if (matchedIdentity) {
                provider = matchedIdentity.provider;
            }
        }
        // provider를 찾지 못했을 경우 기존 방식으로 폴백

        menuLogger(`provider: ${provider}`);

        let extraMessage = '';
        if (provider === 'github') {
            extraMessage =
                '<p class="text-sm text-gray-500 pt-1">' + t.raw('provider-logout-github') + '</p>';
        } else if (provider === 'google') {
            extraMessage =
                '<p class="text-sm text-gray-500 pt-1">' + t.raw('provider-logout-google') + '</p>';
        }
        menuLogger(`extraMessage: ${extraMessage}`);
        addBreadcrumb({
            category: 'auth',
            message: '로그아웃 버튼 클릭',
        });

        // 로그아웃 확인 대화 상자에 체크박스 추가
        let logoutFromAllDevices = false;

        openConfirm({
            message: t('are-you-sure-you-want-to-log-out') + extraMessage,
            onNo: () => {},
            onYes: async () => {
                // 예상치 못한 로그아웃의 원인을 추적하기 위한 코드
                // 원인을 찾은 후에 app/(ui)/Home/layout.tsx, app/(ui)/welcome/layout.tsx, LoginedMenu.tsx의 useEffect에서 관련 로직을 삭제할 것
                communicateWithAppsWithCallback('requestLogoutToNative');

                // 로그아웃 시도 로깅
                addBreadcrumb({
                    category: 'auth',
                    message: '로그아웃 진행 중',
                });

                // Supabase 로그아웃 처리
                try {
                    const signOutOptions = logoutFromAllDevices
                        ? { scope: 'global' as const }
                        : { scope: 'local' as const };
                    menuLogger(`signOutOptions: ${JSON.stringify(signOutOptions)}`);
                    await supabase.auth.signOut(signOutOptions);
                    addBreadcrumb({
                        category: 'auth',
                        message: logoutFromAllDevices
                            ? '로그아웃 완료 (모든 장치)'
                            : '로그아웃 완료 (현재 장치만)',
                    });
                } catch (error) {
                    addBreadcrumb({
                        category: 'auth',
                        message: 'Supabase 로그아웃 실패',
                        data: { error },
                        level: 'error',
                    });
                }

                // 스토리지 정리 시도
                const clearSuccess = await clearStorage(t('clear-storage'));

                if (clearSuccess) {
                    addBreadcrumb({
                        category: 'auth',
                        message: '로그아웃 성공: 스토리지 정리 완료',
                    });

                    // clearStorage 완료 후 즉시 리다이렉트 (Race Condition 방지)
                    // window.location.href로 페이지 전체 리로드하여 모든 상태 초기화
                    window.location.href = '/welcome';
                } else {
                    // 스토리지 정리 실패 시 다시 시도
                    addBreadcrumb({
                        category: 'auth',
                        message: '로그아웃 실패: 스토리지 정리 실패, 다시 시도',
                        level: 'warning',
                    });

                    // 두 번째 시도
                    const secondAttempt = await clearStorage(t('clear-storage'));

                    if (secondAttempt) {
                        addBreadcrumb({
                            category: 'auth',
                            message: '로그아웃 성공: 두 번째 시도 성공',
                        });

                        // 두 번째 시도 성공 시에도 즉시 리다이렉트
                        window.location.href = '/welcome';
                    } else {
                        // 두 번째 시도도 실패하면 강제 리다이렉트
                        addBreadcrumb({
                            category: 'auth',
                            message: '로그아웃 실패: 두 번째 시도도 실패, 강제 리다이렉트',
                            level: 'error',
                        });

                        // 실패해도 리다이렉트는 시도
                        window.location.href = '/welcome';
                    }
                }
            },
            noLabel: t('cancel'),
            yesLabel: t('confirm'),
        });
        onClose();
    };

    const Division = () => (
        <div className="h-[1px] bg-[var(--border-color)] my-2 mx-1 opacity-50" />
    );

    return (
        <Menu
            autoFocus={false}
            anchorEl={loginedMenuAnchor}
            id="account-menu"
            open={open}
            onClose={onClose}
            sx={{
                '*': { fontSize: '1.1rem' },
                '& .MuiPaper-root': {
                    pointerEvents: 'auto',
                    marginTop: '-5px',
                    borderRadius: '20px',
                    minWidth: '20px',
                    padding: '0',
                },
                '& .MuiList-root': {
                    padding: '0',
                },
            }}
            PaperProps={{
                elevation: 0,
                sx: {
                    overflow: 'hidden',
                    boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.12)',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    backgroundColor: 'var(--focus-bg-color)',
                    color: 'var(--text-color)',
                },
            }}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            TransitionComponent={Fade}
        >
            <div className="p-5">
                {/* Header: Profile & Close */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-[40px] h-[40px] rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-bold overflow-hidden">
                            {userInfo?.profile_img_url || user?.user_metadata?.avatar_url ? (
                                <img
                                    src={
                                        userInfo?.profile_img_url || user?.user_metadata?.avatar_url
                                    }
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                userInfo?.nickname?.[0]?.toUpperCase() ||
                                user?.email?.[0].toUpperCase() ||
                                'U'
                            )}
                        </div>
                        <div>
                            <div className="font-bold text-[15px] leading-tight">
                                {userInfo?.nickname ||
                                    user?.user_metadata?.full_name ||
                                    user?.email?.split('@')[0] ||
                                    'User'}
                            </div>
                            <div className="!text-[12px] opacity-50">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 outline-none"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <Division />

                {/* Theme Switcher */}
                <div className="mb-4">
                    <div className="text-[15px] mb-3">{t('theme')}</div>
                    <div className="flex gap-4 flex-wrap">
                        {[
                            {
                                key: 'white',
                                label: t('theme-white'),
                                bgColor: 'bg-[var(--white-bg-color)]',
                                fontColor: 'bg-[var(--white-text-color)]',
                                borderColor: 'border-[var(--white-border-color)]',
                            },
                            {
                                key: 'gray',
                                label: t('theme-gray'),
                                bgColor: 'bg-[var(--gray-bg-color)]',
                                fontColor: 'bg-[var(--gray-text-color)]',
                                borderColor: 'border-transparent',
                            },
                            {
                                key: 'black',
                                label: t('theme-black'),
                                bgColor: 'bg-[var(--black-bg-color)]',
                                fontColor: 'bg-[var(--black-text-color)]',
                                borderColor: 'border-transparent',
                            },
                        ].map((theme) => (
                            <button
                                key={theme.key}
                                onClick={() => applyTheme(theme.key as 'white' | 'gray' | 'black')}
                                className="flex items-center gap-1.5 cursor-pointer group"
                            >
                                <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center border-text-color`}
                                >
                                    {themeMode === theme.key && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-text-color " />
                                    )}
                                </div>
                                <span className={`!text-sm text-color`}>{theme.label}</span>
                                <div className="flex items-center border">
                                    <div className={`w-3 h-3 ${theme.fontColor}`} />
                                    <div className={`w-3 h-3 ${theme.bgColor}`} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <Division />

                {/* Menu Items */}
                <div className="flex flex-col gap-1">
                    <button
                        onClick={() => {
                            setSetting({ open: true });
                            onClose();
                        }}
                        className="flex items-center justify-between py-2 text-left hover:bg-[var(--focus-bg-color)] rounded-lg px-2 -mx-2 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-[15px]">{t('settings')}</span>
                        </div>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-between py-2 text-left hover:bg-[var(--focus-bg-color)] rounded-lg px-2 -mx-2 transition-colors"
                    >
                        <span className="text-[15px]">{t('logout')}</span>
                    </button>
                </div>
            </div>
        </Menu>
    );
}
