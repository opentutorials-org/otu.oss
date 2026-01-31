'use client';
import { isDarkModeAtom, openConfirmState } from '@/lib/jotai';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/supabase/utils/client';
import { clearStorage } from '@/functions/clearStorage';
import { authLogger } from '@/debug/auth';
import Link from 'next/link';
import { agreementType } from '../home/logouted/AgreementForm';
import { termsOfService } from '../home/logouted/docs/terms-of-service_2024_6_20';
import { privacyPolicy } from '../home/logouted/docs/privacy-policy_2024_6_20';
import { marketing } from '../home/logouted/docs/marketing_2024_6_20';
import { useTranslations } from 'next-intl';
import Logo from '@/public/icon/logo_otu';
import Apple from '@mui/icons-material/Apple';
import GitHub from '@mui/icons-material/GitHub';
import Google from '@mui/icons-material/Google';
import { Btn } from './Btn';
import LoadingIcon from '@/public/icon/loading';
import { communicateWithAppsWithCallback } from '../core/WebViewCommunicator';
import { isReactNativeWebView } from '@/functions/detectEnvironment';
import ConfirmDialog from '../common/ConfirmDialog';
import Input from '@mui/material/Input';
import { SESSION_USER_ID_FOR_CHECK_SYNC } from '@/functions/constants';
import { handleNewUserSetupAction } from '@/app/login/actions';

const getURL = () => {
    const windowOrigin = typeof window !== 'undefined' ? window.location.origin : null;
    const fallbackOrigin =
        process?.env?.NEXT_PUBLIC_SOCIAL_LOGIN_REDIRECT_TO ??
        process?.env?.NEXT_PUBLIC_VERCEL_URL ??
        'http://localhost:3000';

    authLogger('getURL origin candidates', {
        windowOrigin,
        fallbackOrigin,
    });

    const selectedOrigin =
        windowOrigin && windowOrigin.trim().length > 0 ? windowOrigin : fallbackOrigin;
    const normalizedOrigin = normalizeBaseUrl(selectedOrigin);

    authLogger('getURL resolved origin', normalizedOrigin);

    return normalizedOrigin;
};

function normalizeBaseUrl(base: string): string {
    const withProtocol = base.includes('http') ? base : `https://${base}`;
    return withProtocol.endsWith('/') ? withProtocol : `${withProtocol}/`;
}

export function Login() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const redirectParam = searchParams?.get('redirect');
    const darkMode = useAtomValue(isDarkModeAtom);
    const openConfirm = useSetAtom(openConfirmState);
    const router = useRouter();
    const t = useTranslations('login');
    const rt = useTranslations();
    const [loading, setLoading] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [githubLoading, setGithubLoading] = useState(false);
    const [agreements, setAgreements] = useState<agreementType>({
        termsOfService: { version: null },
        privacyPolicy: { version: null },
        marketing: { version: null },
    });
    const [isOnline, setIsOnline] = useState(true);

    // 이메일 로그인 폼 상태
    const isDev = process.env.NODE_ENV === 'development';
    const [email, setEmail] = useState(isDev ? 'test@opentutorials.org' : '');
    const [password, setPassword] = useState(isDev ? '111111' : '');
    const [emailFormLoading, setEmailFormLoading] = useState(false);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.onLine) {
            setIsOnline(false);
        }
    }, []);

    useEffect(() => {
        if (pathname === '/signup') {
            document.cookie = `agreements=${JSON.stringify(agreements)}; expires=${new Date(
                Date.now() + 86400000
            ).toUTCString()}; path=/`;
        }
    }, [agreements]);

    function getsearchParams() {
        // 미들웨어에서 전달한 redirect가 있으면 우선 사용 (이미 인코딩된 상태이므로 디코딩 후 사용)
        const redirect = redirectParam ? decodeURIComponent(redirectParam) : '/home';
        return getURL() + 'auth/callback?redirect=' + encodeURIComponent(redirect);
    }

    const [isWebView, setIsWebView] = useState(false);
    useEffect(() => {
        // React Native WebView 환경만 탐지
        if (isReactNativeWebView()) {
            setIsWebView(true);
        }
    }, []);

    async function commonJob(callback: () => void) {
        const handleSignup = () => {
            if (!agreements.termsOfService.version || !agreements.privacyPolicy.version) {
                openConfirm({
                    message: t('please-agree-to-all-terms-and-conditions'),
                    onYes: () => {
                        acceptAgreements();
                        setTimeout(callback, 10);
                    },
                    yesLabel: t('agree'),
                    onNo: () => {},
                    noLabel: t('close'),
                });
            } else {
                callback();
            }
        };

        const handleLogin = async () => {
            authLogger('clear storage before login');
            // 2,3번 인자는 로그인 시에는 서비스 워커와 캐쉬 스토리지를 삭제할 필요가 없기 때문에 false로 설정
            try {
                await clearStorage(t('clear-storage-before-login'), false, false);
            } catch (error) {
                console.error('Login error:', error);
            } finally {
                callback();
            }
        };

        switch (pathname) {
            case '/signup':
                handleSignup();
                break;
            case '/signin':
                await handleLogin();
                break;
            default:
                break;
        }
    }

    async function signInWithGitHub() {
        if (isWebView) {
            communicateWithAppsWithCallback('requestOAuthLoginToNative', { provider: 'github' });
            return;
        }
        authLogger('breadcrumb:', {
            category: 'auth',
            message: 'github로 로그인 시작 함',
        });
        await commonJob(async () => {
            authLogger('github hit');
            const supabase = createClient();
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: getsearchParams(),
                    queryParams: { prompt: 'select_account' },
                },
            });
            if (error) {
                setGithubLoading(false);
                console.error(`Github login failed: ${error.message}`);
                openConfirm({
                    message: `${t('login-failed')}`,
                    onYes: () => {},
                    yesLabel: t('confirm'),
                });
            }
        });
    }

    async function signInWithGoogle() {
        if (isWebView) {
            communicateWithAppsWithCallback('requestOAuthLoginToNative', { provider: 'google' });
            return;
        }
        authLogger('breadcrumb:', {
            category: 'auth',
            message: '구글로 로그인 시작 함',
        });
        if (isInAppBrowser()) {
            openConfirm({
                message: t('google-login-is-not-supported'),
                onYes: acceptAgreements,
                yesLabel: t('confirm'),
            });
        } else {
            await commonJob(async () => {
                const supabase = createClient();
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: getsearchParams(),
                        queryParams: { prompt: 'select_account' },
                    },
                });
                if (error) {
                    setGoogleLoading(false);
                    console.error(`Google login failed: ${error.message}`);
                    openConfirm({
                        message: `${t('login-failed')}`,
                        onYes: () => {},
                        yesLabel: t('confirm'),
                    });
                }
            });
        }
    }

    async function signInWithApple() {
        if (isWebView) {
            communicateWithAppsWithCallback('requestOAuthLoginToNative', { provider: 'apple' });
            return;
        }
        authLogger('breadcrumb:', {
            category: 'auth',
            message: '애플로 로그인 함',
        });
        await commonJob(async () => {
            const supabase = createClient();
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: getsearchParams(),
                    queryParams: { prompt: 'select_account' },
                },
            });
            if (error) {
                setAppleLoading(false);
                console.error(`Apple login failed: ${error.message}`);
                openConfirm({
                    message: `${t('login-failed')}`,
                    onYes: () => {},
                    yesLabel: t('confirm'),
                });
            }
        });
    }

    async function acceptAgreements() {
        setAgreements({
            termsOfService: { version: termsOfService.version },
            privacyPolicy: { version: privacyPolicy.version },
            marketing: { version: marketing.version },
        });
    }

    // 이메일 회원가입 처리
    const handleEmailSignUp = async () => {
        authLogger('이메일 회원가입 시도', { email });
        setEmailFormLoading(true);
        try {
            await commonJob(async () => {
                const supabase = createClient();
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${location.origin}/auth/callback`,
                    },
                });
                authLogger('회원가입 결과', { error, data });
                if (data.user) {
                    document.cookie = `${SESSION_USER_ID_FOR_CHECK_SYNC}=${data.user.id}; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/`;
                    // 신규 사용자 설정 (usage 레코드 추가 + 샘플 페이지 생성)
                    await handleNewUserSetupAction(data.user.id);
                }
                await handleEmailSignInCallback(error, data);
            });
        } finally {
            setEmailFormLoading(false);
        }
    };

    // 이메일 로그인 처리
    const handleEmailSignIn = async () => {
        authLogger('이메일 패스워드로 로그인 시도', { email });
        setEmailFormLoading(true);
        try {
            await commonJob(async () => {
                const supabase = createClient();
                const { error, data } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                authLogger('패스워드로 로그인 결과', { error, data });
                if (data.user) {
                    document.cookie = `${SESSION_USER_ID_FOR_CHECK_SYNC}=${data.user.id}; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/`;
                }
                await handleEmailSignInCallback(error, data);
            });
        } finally {
            setEmailFormLoading(false);
        }
    };

    // 이메일 로그인 콜백 처리
    // @ts-ignore
    async function handleEmailSignInCallback(error, data) {
        if (error) {
            authLogger('이메일 로그인 실패', { email, error });
            openConfirm({
                message: `${t('login-failed')}: ${error.message}`,
                onYes: () => {},
                yesLabel: t('confirm'),
            });
        } else {
            document.cookie = `${SESSION_USER_ID_FOR_CHECK_SYNC}=${data.user.id}; expires=Fri, 31 Dec 9999 23:59:59 GMT`;
            authLogger('이메일 패스워드로 로그인 처리 완료 : ', { data });

            // redirect 파라미터가 있으면 해당 경로로, 없으면 /home으로 이동
            const redirectPath = redirectParam ? decodeURIComponent(redirectParam) : '/home';
            authLogger('Redirecting after email login:', redirectPath);
            router.push(redirectPath);
        }
    }

    authLogger('Login rendering', {
        agreements,
        darkMode,
    });
    const getLabel = () => {
        if (loading) return <LoadingIcon />;
        if (pathname === '/signup') {
            return t('login-or-signup');
        } else if (pathname === '/signin') {
            return t('login-or-signup');
        }
        return '';
    };
    const handleBackClick = () => {
        router.push('/welcome');
    };

    return (
        <div className="flex justify-center items-center h-svh text-white">
            <div className="flex flex-col gap-4 p-12 bg-color items-center w-full min-w-[200px] text-color">
                {/* 뒤로가기 버튼 */}

                <div className="max-w-[348px] w-full">
                    <button onClick={handleBackClick} className="text-[15px] text-color float-left">
                        {rt('navigation.back')}
                    </button>
                    <div className="flex justify-center items-center w-full min-h-[89px]">
                        <Logo className="fill-text-color" width="80" height="39"></Logo>
                    </div>
                </div>
                <div className="text-[10pt] mb-1 h-[20px] ">{getLabel()}</div>

                {/* 이메일 로그인 폼 (기본 화면) */}
                <div className="flex flex-col gap-2 w-full max-w-[348px]">
                    <Input
                        name="email"
                        placeholder="email"
                        onChange={(e) => setEmail(e.target.value)}
                        value={email}
                        className="bg-white px-2 rounded-md"
                        disabled={emailFormLoading}
                    />
                    <Input
                        type="password"
                        name="password"
                        placeholder="password"
                        onChange={(e) => setPassword(e.target.value)}
                        value={password}
                        className="bg-white px-2 rounded-md"
                        disabled={emailFormLoading}
                    />
                    <div className="flex gap-2 mt-2">
                        <Btn
                            onClick={(event) => {
                                event.stopPropagation();
                                handleEmailSignUp();
                            }}
                            loading={emailFormLoading}
                        >
                            {rt('common.signup')}
                        </Btn>
                        <Btn
                            onClick={(event) => {
                                event.stopPropagation();
                                handleEmailSignIn();
                            }}
                            loading={emailFormLoading}
                        >
                            {rt('navigation.login')}
                        </Btn>
                    </div>
                </div>

                {/* 소셜 로그인 옵션 (환경변수로 제어) */}
                {process.env.NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN === 'true' && (
                    <>
                        {/* 구분선 */}
                        <div className="text-[13px] opacity-50 mt-4">{t('or')}</div>

                        <Btn
                            onClick={(event) => {
                                event.stopPropagation();
                                setAppleLoading(true);
                                signInWithApple();
                            }}
                            loading={appleLoading}
                        >
                            <Apple className="w-[18px]" /> {t('login-with-apple')}
                        </Btn>
                        <Btn
                            onClick={(event) => {
                                event.stopPropagation();
                                setGoogleLoading(true);
                                signInWithGoogle();
                            }}
                            loading={googleLoading}
                        >
                            <Google className="w-[17px] mr-1" /> {t('login-with-google')}
                        </Btn>
                        <Btn
                            onClick={(event) => {
                                event.stopPropagation();
                                setGithubLoading(true);
                                signInWithGitHub();
                            }}
                            loading={githubLoading}
                        >
                            <GitHub className="w-[17px] mr-1" /> {t('login-with-github')}
                        </Btn>
                    </>
                )}
                <div className="text-[13px] opacity-50 mt-3">
                    {t.rich('by-signing-up-or-logging-in-terms-of-service-are-considered-agreed', {
                        'terms-of-service': (chunk) => (
                            <Link href="/consent#terms-of-service" className="underline">
                                {chunk}
                            </Link>
                        ),
                    })}
                </div>
                <ConfirmDialog />
            </div>
        </div>
    );
}
type BaseLoginButtonProps = {
    logo?: string;
    label: string;
    size?: number;
    onClick: (event: React.MouseEvent) => void;
    className: string;
    labelClassName: string;
};

function BaseLoginButton({
    logo,
    label,
    onClick,
    size = 18,
    className,
    labelClassName,
}: BaseLoginButtonProps) {
    return (
        <div
            className={`h-[48px] border-color border-[1px] text-color text-[14px] font-bold flex justify-center items-center gap-2 max-w-[348px] w-full rounded-[3px]`}
            onClick={onClick}
        >
            {logo && (
                <Image
                    className="absolute left-5"
                    width={size}
                    height={size}
                    src={logo}
                    alt={label + ' button'}
                />
            )}
            <div className={`text-[11pt] px-3 ${labelClassName}`}>{label}</div>
        </div>
    );
}

type LoginButtonProps = {
    logo?: string;
    label: string;
    size?: number;
    onClick: (event: React.MouseEvent) => void;
};

function LoginButton({ logo, label, onClick, size = 18 }: LoginButtonProps) {
    return (
        <BaseLoginButton
            logo={logo}
            label={label}
            onClick={onClick}
            size={size}
            className="dark:bg-white bg-black border-[#c4c4c4]"
            labelClassName="dark:text-black text-white"
        />
    );
}

function LoginButton2({ logo, label, onClick, size = 18 }: LoginButtonProps) {
    return (
        <BaseLoginButton
            logo={logo}
            label={label}
            onClick={onClick}
            size={size}
            className="dark:bg-[#373737] bg-black border-[#121212]"
            labelClassName="dark:text-white text-white"
        />
    );
}

function isInAppBrowser() {
    if (typeof window === 'undefined') {
        return false;
    }
    // 인앱 브라우저를 식별할 수 있는 키워드 목록
    const inAppIdentifiers = [
        'FBAN',
        'FBAV',
        'Twitter',
        'Line',
        'NAVER',
        'Instagram',
        'Pinterest',
        'Snapchat',
        'inapp',
    ];

    // 주어진 사용자 에이전트를 소문자로 변환하여 대소문자 구분 없이 비교
    const userAgentLower = window.navigator.userAgent.toLowerCase();

    // 인앱 식별자 중 하나라도 사용자 에이전트에 포함되어 있는지 확인
    return inAppIdentifiers.some((identifier) => userAgentLower.includes(identifier.toLowerCase()));
}
