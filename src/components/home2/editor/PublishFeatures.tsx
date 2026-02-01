import { content } from '@/types';
import React, { useCallback, useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    openSnackbarState,
    profileDialogState,
    settingState,
    profileUpdateState,
    openConfirmState,
    closeConfirmState,
    runSyncState,
    refreshListState,
} from '@/lib/jotai';
import { createClient, fetchUserId } from '@/supabase/utils/client';
import { useLingui } from '@lingui/react/macro';
import IconButton from '@mui/material/IconButton';
import CopyBeforeIcon from '@/public/icon/copyBeforeIcon';
import BookIcon from '@/public/icon/BookIcon';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import * as PageControl from '@/watermelondb/control/Page';
import { publishLogger } from '@/debug/publish';
import { openExternalLink } from '@/utils/openExternalLink';

// 재사용 가능한 다이얼로그 컴포넌트
const PublishDialogContent = ({
    title,
    shareableLink,
    buttons,
}: {
    title: string;
    shareableLink: string;
    buttons: (
        | { label: string; onClick: () => void }
        | { label: string; href: string; target?: string }
    )[];
}) => {
    // 링크 버튼 (href가 있는 경우)
    const LinkButton = ({
        label,
        onClick,
        href,
        target,
    }: {
        label: string;
        onClick?: () => void;
        href: string;
        target?: string;
    }) => (
        <Button variant="contained" onClick={() => openExternalLink(href)}>
            {label}
        </Button>
    );

    // 일반 버튼 (href가 없는 경우)
    const RegularButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
        <Button variant="contained" onClick={onClick}>
            {label}
        </Button>
    );

    return (
        <div className="flex flex-col gap-4 p-2">
            <div className="text-center mb-4">
                <p className="text-lg font-medium">{title}</p>
            </div>
            <div className="flex justify-center gap-3 mt-2">
                {buttons.map((button, index) =>
                    'href' in button ? (
                        <LinkButton
                            key={index}
                            label={button.label}
                            href={button.href}
                            target={button.target}
                        />
                    ) : (
                        <RegularButton key={index} label={button.label} onClick={button.onClick} />
                    )
                )}
            </div>
        </div>
    );
};

// 발행 관련 기능을 위한 커스텀 훅
export const usePublishFeatures = (content: content, mode?: 'create' | 'update' | null) => {
    const supabase = createClient();
    const [isPublished, setIsPublished] = useState(false);
    const [pendingPublish, setPendingPublish] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const { t } = useLingui();
    const openSnackbar = useSetAtom(openSnackbarState);
    const setProfileDialog = useSetAtom(profileDialogState);
    const setConfirm = useSetAtom(openConfirmState);
    const closeConfirm = useSetAtom(closeConfirmState);
    const [setting, setSetting] = useAtom(settingState);
    const profileUpdateCount = useAtomValue(profileUpdateState);
    const runSync = useSetAtom(runSyncState);
    const refreshList = useSetAtom(refreshListState);

    // 현재 콘텐츠가 발행되었는지 확인
    useEffect(() => {
        // 생성 모드에서는 is_public 체크를 건너뜀
        if (mode === 'create') {
            // create 모드일 때는 명시적으로 false로 설정
            setIsPublished(false);
            return;
        }

        if (content && content.id) {
            // create에서 update로 변경된 직후라면 잠시 지연 후 확인
            publishLogger(`PublishFeatures: 새로 생성된 페이지 ${content.id} - 1초 후 상태 확인`);
            setIsPublished(false); // 우선 false로 설정
            setTimeout(() => {
                fetchPublishStatus(content.id);
            }, 1000);
        }
    }, [content.id, mode]);

    // 서버에서 직접 발행 상태를 확인하는 함수
    const fetchPublishStatus = useCallback(
        async (pageId: string) => {
            // 생성 모드에서는 is_public 체크를 건너뜀
            if (mode === 'create') {
                setIsPublished(false);
                return false;
            }

            try {
                publishLogger(`PublishFeatures: 페이지 ID ${pageId} 공개 상태 확인 중`);
                setIsCheckingStatus(true);

                // 수퍼베이스에서 최신 상태 직접 확인
                const { data, error } = await supabase
                    .from('page')
                    .select('is_public')
                    .eq('id', pageId)
                    .maybeSingle();

                if (error) {
                    publishLogger(
                        `PublishFeatures: 페이지 ID ${pageId} 공개 상태 확인 오류`,
                        error
                    );
                    console.error('공개 상태 확인 오류:', error);
                    setIsCheckingStatus(false);
                    setIsPublished(false); // 오류 시 false로 설정
                    return false;
                }

                if (!data) {
                    publishLogger(
                        `PublishFeatures: 페이지 ID를 가져오지 못했음. 새로 생성된 페이지이므로 false로 설정.`
                    );
                    setIsCheckingStatus(false);
                    setIsPublished(false); // 데이터가 없으면 false로 설정
                    return false;
                }

                // 서버에서 받아온 상태로 UI 업데이트
                const isPublic = data.is_public === true;
                publishLogger(`PublishFeatures: 페이지 ID ${pageId} 공개 상태 = ${isPublic}`);
                setIsPublished(isPublic);
                setIsCheckingStatus(false);
                return isPublic;
            } catch (error) {
                publishLogger(
                    `PublishFeatures: 페이지 ID ${pageId} 공개 상태 확인 중 예외 발생`,
                    error
                );
                console.error('공개 상태 확인 중 예외 발생:', error);
                setIsCheckingStatus(false);
                setIsPublished(false); // 예외 시 false로 설정
                return false;
            }
        },
        [supabase, mode]
    );

    // 프로필이 업데이트되었을 때, 발행 대기 중이었다면 자동으로 발행 프로세스를 진행
    useEffect(() => {
        if (pendingPublish && profileUpdateCount > 0) {
            // 닉네임이 설정되었는지 확인
            supabase
                .from('user_info')
                .select('nickname')
                .single()
                .then(({ data, error }) => {
                    if (!error && data?.nickname) {
                        // 닉네임이 설정되었으면 발행 프로세스 진행
                        publishContent();
                        setPendingPublish(false);

                        // 프로필 설정창 닫기
                        setSetting((prev) => ({
                            ...prev,
                            open: false,
                        }));
                        setProfileDialog((prev) => ({
                            ...prev,
                            open: false,
                        }));
                    }
                });
        }
    }, [profileUpdateCount, pendingPublish]);

    const handleCopyPublishedLink = useCallback(() => {
        // Create a shareable link
        const shareableLink = `${window.location.origin}/share/${content.id}`;
        navigator.clipboard.writeText(shareableLink).then(() => {
            openSnackbar({ message: t`링크가 복사되었습니다.` });
        });
    }, [content.id, openSnackbar, t]);

    // 공통 다이얼로그 표시 함수
    const showPublishDialog = useCallback(
        (title: string) => {
            const shareableLink = `${window.location.origin}/share/${content.id}`;

            setConfirm({
                message: '',
                customContent: (
                    <PublishDialogContent
                        title={title}
                        shareableLink={shareableLink}
                        buttons={[
                            {
                                label: t`링크 복사`,
                                onClick: () => {
                                    navigator.clipboard.writeText(shareableLink).then(() => {
                                        openSnackbar({ message: t`링크가 복사되었습니다.` });
                                    });
                                },
                            },
                            {
                                label: t`링크 열기`,
                                href: shareableLink,
                            },
                            {
                                label: t`발행 취소`,
                                onClick: () => {
                                    // 다이얼로그 닫고 발행 취소 처리
                                    closeConfirm();
                                    setTimeout(() => {
                                        unpublishContent();
                                    }, 100);
                                },
                            },
                        ]}
                    />
                ),
                onYes: false,
                onNo: () => {},
                noLabel: t`닫기`,
                closeOnBackdropClick: true,
            });
        },
        [content.id, t, closeConfirm, openSnackbar, setConfirm]
    );

    // 페이지 발행 상태 변경 (서버 우선 업데이트 방식으로 수정)
    const updatePagePublicStatus = async (isPublic: boolean) => {
        try {
            publishLogger(
                `PublishFeatures: 페이지 ID ${content.id} 공개 상태 변경 시작 (${isPublic ? '공개' : '비공개'})`
            );
            setIsUpdating(true);

            // fetchUserId 사용하여 현재 사용자 ID 가져오기
            const userId = await fetchUserId('PublishFeatures');
            publishLogger(`PublishFeatures: 사용자 ID ${userId} 확인됨`);

            if (!userId) {
                publishLogger(`PublishFeatures: 사용자 ID를 찾을 수 없음`);
                throw new Error('사용자 정보가 없습니다. 다시 로그인해주세요.');
            }

            // 1. 서버(Supabase)에 is_public 직접 변경 (user_id 명시적 포함)
            publishLogger(`PublishFeatures: 서버에 페이지 ID ${content.id} 공개 상태 업데이트 중`);
            const { error } = await supabase
                .from('page')
                .update({
                    is_public: isPublic,
                    updated_at: new Date().toISOString(),
                    user_id: userId, // 명시적으로 user_id 포함
                })
                .eq('id', content.id);

            if (error) {
                publishLogger(`PublishFeatures: 서버 업데이트 실패`, error);
                throw new Error(`서버 업데이트 실패: ${error.message}`);
            }

            // 2. 캐시 관련 처리 (isPublic 상태와 무관하게 항상 실행)
            const host = window.location.origin;
            const shareUrl = `${host}/share/${content.id}`;
            const shareApiUrl = `${host}/api/share/${content.id}`;

            publishLogger(`PublishFeatures: 캐시 갱신 시작 (shareUrl=${shareUrl})`);

            // 서비스 워커 캐시 삭제
            try {
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    publishLogger(`PublishFeatures: 서비스워커 캐시 삭제 시작`);
                    const cacheNames = ['share-pages', 'share-api', 'pages-rsc', 'pages'];

                    cacheNames.forEach(async (cacheName) => {
                        try {
                            const cache = await caches.open(cacheName);
                            const keys = await cache.keys();
                            const shareKeys = keys.filter(
                                (request) =>
                                    request.url.includes(`/share/${content.id}`) ||
                                    request.url.includes(`/api/share/${content.id}`)
                            );

                            shareKeys.forEach((request) => {
                                cache.delete(request);
                                publishLogger(
                                    `PublishFeatures: 캐시 삭제 완료: ${request.url} (${cacheName})`
                                );
                            });
                        } catch (e) {
                            publishLogger(`PublishFeatures: 캐시 ${cacheName} 삭제 실패`, e);
                            console.warn(`캐시 ${cacheName} 삭제 실패:`, e);
                        }
                    });
                }
            } catch (cacheError) {
                publishLogger(`PublishFeatures: 서비스 워커 캐시 삭제 실패`, cacheError);
                console.warn('서비스 워커 캐시 삭제 실패:', cacheError);
            }

            // Next.js 태그 캐시 무효화
            const revalidateUrl = `${host}/api/share/revalidate?id=${content.id}`;
            publishLogger(`PublishFeatures: 서버 캐시 태그 무효화 요청 ${revalidateUrl}`);
            fetch(revalidateUrl, {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' },
                cache: 'no-store',
            })
                .then((response) => {
                    if (response.ok) {
                        publishLogger(
                            `PublishFeatures: 서버 캐시 태그 무효화 성공 (${response.status})`
                        );
                    } else {
                        publishLogger(
                            `PublishFeatures: 서버 캐시 태그 무효화 응답 오류 (${response.status})`
                        );
                    }
                })
                .catch((e) => {
                    publishLogger(`PublishFeatures: 서버 캐시 태그 무효화 요청 실패`, e);
                    console.warn('서버 캐시 revalidate 요청 실패:', e);
                });

            // 4. WatermelonDB 동기화 실행 (백그라운드) - 폴더 정보 포함
            try {
                // 서버에서 업데이트된 데이터를 로컬로 가져오기 위한 동기화
                publishLogger(`PublishFeatures: WatermelonDB 동기화 실행`);
                const { triggerSync } = await import('@/functions/sync');
                triggerSync(
                    'components/home/logined/page/CreateUpdate/PublishFeatures:updatePagePublicStatus'
                );
                // 발행 상태 변경 후 목록 갱신을 즉시+1초 후 실행 (외과수술적 업데이트)
                refreshList({
                    source: 'components/home/logined/page/CreateUpdate/PublishFeatures',
                    pageId: content.id,
                    action: 'update',
                });
            } catch (syncError) {
                publishLogger(`PublishFeatures: 동기화 오류 발생`, syncError);
                console.error('Sync error after publish status update:', syncError);
            }

            // 서버 응답에 기반하여 상태 즉시 업데이트 (서버 재확인 없이)
            setIsPublished(isPublic);
            setIsUpdating(false);
            publishLogger(
                `PublishFeatures: 페이지 ID ${content.id} 공개 상태 변경 완료 (${isPublic ? '공개' : '비공개'})`
            );
            return true;
        } catch (error) {
            publishLogger(`PublishFeatures: 공개 상태 변경 오류`, error);
            console.error('공개 상태 변경 오류:', error);
            openSnackbar({
                message: t`상태 변경 중 오류가 발생했습니다`,
                severity: 'error',
            });
            setIsUpdating(false);
            return false;
        }
    };

    // 발행 처리 함수
    const publishContent = async () => {
        publishLogger(`PublishFeatures: 페이지 ID ${content.id} 공개 처리 시작`);
        const success = await updatePagePublicStatus(true);
        if (success) {
            // 성공 다이얼로그 표시
            publishLogger(`PublishFeatures: 페이지 ID ${content.id} 공개 성공 다이얼로그 표시`);
            showPublishDialog(t`발행되었습니다.`);
        }
    };

    // 발행 취소 처리 함수
    const unpublishContent = async () => {
        publishLogger(`PublishFeatures: 페이지 ID ${content.id} 비공개 처리 시작`);
        const success = await updatePagePublicStatus(false);
        if (success) {
            // 스낵바로 결과 알림
            publishLogger(`PublishFeatures: 페이지 ID ${content.id} 비공개 처리 성공 알림`);
            openSnackbar({ message: t`발행이 취소되었습니다.` });
        }
    };

    const handlePublishClick = async () => {
        publishLogger(`PublishFeatures: 공개 버튼 클릭 처리 시작`);

        // 생성 모드에서는 is_public 체크를 건너뜀
        let isPublic = false;
        if (mode !== 'create' && content.id) {
            // 직전에 서버에서 상태를 한번 더 확인하고 그 값을 직접 사용
            isPublic = await fetchPublishStatus(content.id);
        }

        // 이미 발행된 경우, 발행 정보 다이얼로그 표시
        if (isPublic) {
            publishLogger(`PublishFeatures: 이미 공개된 페이지 - 공유 다이얼로그 표시`);
            showPublishDialog(t`현재 공유 중입니다.`);
            return;
        }

        // content.user_id에 의존하지 않고 직접 현재 로그인한 사용자 ID 가져오기
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;

        if (!userId) {
            publishLogger(`PublishFeatures: 사용자 세션을 찾을 수 없음`);
            console.error('사용자 세션을 찾을 수 없습니다');
            openSnackbar({
                message: t`사용자 정보가 없습니다. 다시 로그인해주세요.`,
            });
            return;
        }

        // First check if user has nickname
        const { data: userData, error: userError } = await supabase
            .from('user_info')
            .select('nickname')
            .eq('user_id', userId)
            .maybeSingle();

        if (userError) {
            publishLogger(`PublishFeatures: 사용자 정보 확인 오류`, userError);
            console.error('Error checking user info:', userError);
            return;
        }

        if (!userData?.nickname) {
            publishLogger(`PublishFeatures: 닉네임 없음 - 프로필 설정 다이얼로그 표시`);
            // User has no nickname, show dialog to set up profile
            setPendingPublish(true); // 프로필 설정 후 발행을 위해 대기 상태로 설정
            setConfirm({
                message: t`최초 발행시 닉네임과 이미지를 설정해야 합니다.`,
                onYes: () => {
                    // Open profile settings dialog
                    setSetting((prev) => ({
                        ...prev,
                        open: true,
                    }));
                    setProfileDialog((prev) => ({
                        ...prev,
                        open: true,
                    }));
                },
                yesLabel: t`프로필 설정`,
                noLabel: t`취소`,
                onNo: () => {
                    // 취소하면 발행 대기 상태도 취소
                    setPendingPublish(false);
                },
            });
        } else {
            publishLogger(`PublishFeatures: 닉네임 있음 - 발행 확인 다이얼로그 표시`);
            // User has nickname, show publish confirmation
            setConfirm({
                message: t`링크가 있는 모든 사용자가 볼 수 있습니다. 발행하시겠습니까?`,
                onYes: async () => {
                    await publishContent();
                },
                onNo: () => {},
                noLabel: t`취소`,
                yesLabel: t`발행`,
            });
        }
    };

    // 훅에서는 상태와 함수만 반환하도록 수정
    return {
        isPublished,
        isUpdating,
        isCheckingStatus,
        handlePublishClick,
        publishContent,
        unpublishContent,
        handleCopyPublishedLink,
        fetchPublishStatus,
    };
};

// 별도 컴포넌트로 분리
export const PublishButton = ({
    isPublished,
    onClick,
    disabled = false,
    opacity = '.65',
    hideTextOnMobile = false,
    isUpdating = false,
    isCheckingStatus = false,
}: {
    isPublished: boolean;
    onClick: () => void;
    disabled?: boolean;
    opacity?: string;
    hideTextOnMobile?: boolean;
    isUpdating?: boolean;
    isCheckingStatus?: boolean;
}) => {
    const { t } = useLingui();

    // 로딩/확인 중일 때 애니메이션 적용
    if (isUpdating || isCheckingStatus) {
        return (
            <IconButton
                disableRipple
                className={`!p-0 !opacity-[${opacity}] animate-pulse`}
                disabled={true}
                title={isPublished ? t`발행됨` : t`발행`}
            >
                <BookIcon width="14" height="14" className="mr-[2px]" />
                <span
                    className={`text-[10px] ${hideTextOnMobile ? 'inline-block max-sm:hidden' : 'hide-on-400'}`}
                >
                    {isPublished ? t`발행됨` : t`발행`}
                </span>
            </IconButton>
        );
    }

    return (
        <IconButton
            disableRipple
            className={`!p-0 !opacity-[${opacity}] ${!disabled ? 'hover:!opacity-[1]' : 'cursor-not-allowed'}`}
            onClick={onClick}
            title={isPublished ? t`발행 취소` : t`발행`}
            disabled={disabled}
        >
            <BookIcon width="14" height="14" className="mr-[2px]" />
            <span
                className={`text-[10px] ${hideTextOnMobile ? 'inline-block max-sm:hidden' : 'hide-on-400'}`}
            >
                {isPublished ? t`발행됨` : t`발행`}
            </span>
        </IconButton>
    );
};

export default usePublishFeatures;
