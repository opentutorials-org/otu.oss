'use client';
import {
    isModifiedState,
    loginedMenuAnchorState,
    profileUpdateState,
    currentPageState,
    resetSearchState,
} from '@/lib/jotai';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState, useCallback, useRef, Suspense, lazy } from 'react';
import { useImmer } from 'use-immer';
import Image from 'next/image';
import { createClient } from '@/supabase/utils/client';
import { User } from '@supabase/supabase-js';
import Logo from '@/public/icon/logo_otu';
import { useTranslations } from 'next-intl';
import LoadingIcon from '@/public/icon/loading';
import Avatar from '@mui/material/Avatar';
import React from 'react';
import { interactionLogger } from '@/debug/interaction';
import { handlePageClose } from '@/utils/pageCloseHandler';

// LoginedMenu를 동적 로딩하여 초기 번들 크기 감소
const LoginedMenu = lazy(() => import('../LoginedMenu').then((m) => ({ default: m.LoginedMenu })));

// props 타입 정의 추가
type UserContentProps = {
    user: User | undefined;
    userInfo: any;
    setLoginedMenuAnchor: any;
};

const LoadingView = React.memo(() => {
    const loadingRef = useRef<HTMLDivElement>(null);

    useEffect(function setupLoadingViewEventListener() {
        const element = loadingRef.current;
        interactionLogger('setupLoadingViewEventListener called', {
            hasElement: !!element,
            elementTagName: element?.tagName,
        });

        if (!element) return;

        const handleClick = (e: Event) => {
            interactionLogger('LoadingView clicked via addEventListener - reloading page');
            e.preventDefault();
            e.stopPropagation();
            location.reload();
        };

        element.addEventListener('click', handleClick);
        return () => element.removeEventListener('click', handleClick);
    }, []);

    const handleClickFallback = useCallback((e: React.MouseEvent) => {
        interactionLogger('LoadingView clicked via onClick fallback - reloading page');
        e.preventDefault();
        e.stopPropagation();
        location.reload();
    }, []);

    return (
        <div
            ref={loadingRef}
            onClick={handleClickFallback}
            className="cursor-pointer opacity-50"
            style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <LoadingIcon sx={{ width: 32, height: 32 }} />
        </div>
    );
});

const UserContent = React.memo<UserContentProps>(({ user, userInfo, setLoginedMenuAnchor }) => {
    const userContentRef = useRef<HTMLDivElement>(null);
    const profileImgUrl = userInfo?.profile_img_url;

    useEffect(
        function setupUserContentEventListener() {
            const element = userContentRef.current;
            interactionLogger('setupUserContentEventListener called', {
                hasElement: !!element,
                elementTagName: element?.tagName,
                hasUserInfo: !!userInfo,
            });

            if (!element) return;

            const handleClick = (e: Event) => {
                interactionLogger('UserContent clicked via addEventListener - opening user menu', {
                    hasUserInfo: !!userInfo,
                });
                e.preventDefault();
                e.stopPropagation();
                setLoginedMenuAnchor(e.currentTarget);
            };

            element.addEventListener('click', handleClick);
            return () => element.removeEventListener('click', handleClick);
        },
        [setLoginedMenuAnchor, userInfo]
    );

    const handleClickFallback = useCallback(
        (e: React.MouseEvent) => {
            interactionLogger('UserContent clicked via onClick fallback - opening user menu', {
                hasUserInfo: !!userInfo,
            });
            e.preventDefault();
            e.stopPropagation();
            setLoginedMenuAnchor(e.currentTarget);
        },
        [setLoginedMenuAnchor, userInfo]
    );

    return (
        <div
            ref={userContentRef}
            onClick={handleClickFallback}
            style={{
                width: 32,
                height: 32,
                position: 'relative',
                cursor: 'pointer',
            }}
            className="group"
        >
            <Avatar
                sx={{
                    width: 32,
                    height: 32,
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    border: 'none',
                    bgcolor: 'transparent',
                    color: 'text.primary',
                    '&:hover': {
                        opacity: 0.8,
                    },
                    // 내부 img 태그에 명시적인 크기 설정으로 CLS 방지
                    '& img': {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    },
                }}
                imgProps={{
                    // 내부 img 태그에 명시적인 width/height 속성 추가로 CLS 방지
                    width: 32,
                    height: 32,
                    loading: 'lazy',
                }}
                src={profileImgUrl}
                alt={'Profile'}
                title={'Profile'}
            >
                {profileImgUrl ? null : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1}
                        stroke="currentColor"
                        style={{ width: '100%', height: '100%' }}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                    </svg>
                )}
            </Avatar>
        </div>
    );
});

interface TopProps {
    menu?: boolean;
}

export const Top = React.memo(({ menu = true }: TopProps) => {
    const t = useTranslations();
    const [user, setUser] = useState<User | undefined>(undefined);
    const [userInfo, setUserInfo] = useImmer<any>(null);
    const profileUpdate = useAtomValue(profileUpdateState);
    const setLoginedMenuAnchor = useSetAtom(loginedMenuAnchorState);
    const [currentPage, setCurrentPage] = useAtom(currentPageState);
    const resetSearch = useSetAtom(resetSearchState);
    const [isModified, setIsModified] = useAtom(isModifiedState);
    const [isMounted, setIsMounted] = useState(false);

    // 로고 클릭 처리
    const handleLogoClick = useCallback(
        (e: React.MouseEvent) => {
            interactionLogger('Logo clicked', {
                currentPageType: currentPage.type,
                isModified,
            });

            e.preventDefault();
            e.stopPropagation();

            handlePageClose({
                currentPage,
                isModified,
                resetSearch,
                triggerSource: 'logo-click',
                forceHomeNavigation: true,
            });
        },
        [currentPage, isModified, resetSearch]
    );

    const loadUserInfo = useCallback(
        async (userId: string) => {
            const supabase = createClient();
            const userInfoResult = await supabase
                .from('user_info')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!userInfoResult.error && userInfoResult.data) {
                setUserInfo(userInfoResult.data);
            }
        },
        [setUserInfo]
    );

    useEffect(
        function loadUserSession() {
            const loadSession = async () => {
                if (user?.id) {
                    await loadUserInfo(user.id);
                } else {
                    const supabase = createClient();
                    const result = await supabase.auth.getSession();
                    if (result?.data?.session?.user) {
                        setUser(result.data.session.user);
                        await loadUserInfo(result.data.session.user.id);
                    }
                }
            };

            loadSession();
        },
        [loadUserInfo, user?.id, profileUpdate]
    );

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 사용자 콘텐츠 렌더링 여부 결정
    const shouldRenderUserContent = isMounted && menu && user;

    return (
        <>
            <div
                id="top"
                data-role="root"
                className={`flex justify-center w-full z-20 pb-[10px]`}
                style={{
                    paddingTop: 'calc(var(--native-top-inset, env(safe-area-inset-top)) + 20px)',
                }}
            >
                <div
                    className="w-full h-full max-w-[680px] px-1 grid"
                    style={{ gridTemplateColumns: 'auto 1fr auto' }}
                >
                    {/* 항상 Logo만 표시 */}
                    <a
                        title={t('navigation.home')}
                        href="/home/page"
                        className="no-underline font-bold text-2xl pl-[11px]"
                    >
                        <Logo width="43" className="fill-text-color" />
                    </a>
                    <div></div>
                    <div
                        className="inline pr-[35px]"
                        style={{
                            width: 32,
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {shouldRenderUserContent ? (
                            <UserContent
                                user={user}
                                userInfo={userInfo}
                                setLoginedMenuAnchor={setLoginedMenuAnchor}
                            />
                        ) : (
                            <LoadingView />
                        )}
                    </div>
                </div>
            </div>
            <Suspense fallback={null}>
                <LoginedMenu
                    onClose={() => {
                        setLoginedMenuAnchor(null);
                    }}
                />
            </Suspense>
        </>
    );
});
