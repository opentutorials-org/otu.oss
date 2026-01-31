'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { openSnackbarState, openConfirmState, refreshListState } from '@/lib/jotai';
import { createClient, fetchUserId } from '@/supabase/utils/client';
import { alarmLogger } from '@/debug/alarm';
import { webviewLogger } from '@/debug/webview';
import { openExternalLink } from '@/utils/openExternalLink';
import { ulid } from 'ulid';
import { communicateWithAppsWithCallback } from '@/components/core/WebViewCommunicator';
import { checkIsSuperuser } from '@/functions/checkSuperuser';
import { isProduction } from '@/utils/environment';
import { addBreadcrumb, captureException } from '@sentry/nextjs';
import { database } from '@/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { sync } from '@/watermelondb/sync';
import Alarm from '@/watermelondb/model/Alarm';

interface UseAlarmFeaturesProps {
    title: string;
    body: string;
    pageId: string;
}

export function useAlarmFeatures({ title, body, pageId }: UseAlarmFeaturesProps) {
    const [isAlarmActive, setIsAlarmActive] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const openSnackbar = useSetAtom(openSnackbarState);
    const openConfirm = useSetAtom(openConfirmState);
    // 리마인더 상태 변경 시 글목록 갱신을 위한 트리거
    const refreshList = useSetAtom(refreshListState);
    const rt = useTranslations('read');
    const c = useTranslations('common');
    const at = useTranslations('alarm');
    const supabase = createClient();

    // 초기화 로그를 한 번만 출력하기 위한 ref
    const hasLoggedInit = useRef(false);
    const previousPageId = useRef(pageId);

    // 사용자 ID 가져오기
    useEffect(
        function initializeUserId() {
            const initUser = async () => {
                try {
                    const fetchedUserId = await fetchUserId('useAlarmFeatures');
                    setUserId(fetchedUserId);
                    alarmLogger('useAlarmFeatures - 사용자 초기화 완료', {
                        userId: fetchedUserId ? fetchedUserId.substring(0, 8) + '...' : 'null',
                    });
                } catch (error) {
                    alarmLogger('useAlarmFeatures - 사용자 정보 없음', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            };

            initUser();
        },
        [supabase]
    );

    // pageId가 변경되거나 처음 로드될 때만 로그 출력
    if (pageId && (!hasLoggedInit.current || previousPageId.current !== pageId)) {
        alarmLogger('useAlarmFeatures 훅 초기화', {
            pageId,
            userId: userId ? userId.substring(0, 8) + '...' : 'null',
            titleLength: title?.length || 0,
            bodyLength: body?.length || 0,
            hasContent: !!(title || body),
        });
        hasLoggedInit.current = true;
        previousPageId.current = pageId;
    }

    // pageId가 변경될 때마다 알람 상태 확인
    useEffect(
        function checkAlarmStatus() {
            const checkStatus = async () => {
                if (!pageId || !userId) {
                    // 빈 값일 때는 debug 레벨로만 로그 출력
                    if (pageId) {
                        alarmLogger('useAlarmFeatures - userId 대기중', { pageId });
                    }
                    return;
                }

                alarmLogger('useAlarmFeatures - 알람 상태 확인 시작', { pageId });

                try {
                    const alarmCollection = database.collections.get<Alarm>('alarm');
                    const alarms = await alarmCollection.query(Q.where('page_id', pageId)).fetch();

                    const alarmExists = alarms.length > 0;
                    setIsAlarmActive(alarmExists);
                    alarmLogger('useAlarmFeatures - 알람 상태 확인 완료', {
                        pageId,
                        alarmExists,
                        alarmId: alarms[0]?.id,
                    });
                } catch (error) {
                    alarmLogger('useAlarmFeatures - 알람 상태 확인 예외', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        pageId,
                    });
                }
            };

            checkStatus();
        },
        [pageId, userId]
    );

    /**
     * HTML 태그를 제거하고 줄바꿈을 적절히 처리하는 함수
     * @param html HTML 문자열
     * @returns 처리된 텍스트
     */
    const sanitizeContent = (html: string): string => {
        if (!html) return '';

        // HTML 태그 제거 및 줄바꿈 처리
        return (
            html
                // <br>, <br/>, <br /> 태그를 줄바꿈으로 변환
                .replace(/<br\s*\/?>/gi, '\n')
                // <p> 태그를 이중 줄바꿈으로 변환
                .replace(/<\/?p>/gi, '\n\n')
                // <div> 태그를 줄바꿈으로 변환
                .replace(/<\/?div>/gi, '\n')
                // 나머지 HTML 태그 제거
                .replace(/<[^>]*>/g, '')
                // HTML 엔티티 디코딩
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                // 연속된 줄바꿈을 2개로 정리
                .replace(/\n{3,}/g, '\n\n')
                // 앞뒤 공백 제거
                .trim()
        );
    };

    /**
     * 사용자의 timezone을 확인하고 필요시 업데이트하는 함수
     */
    const ensureUserTimezone = async (userId: string) => {
        try {
            // 현재 사용자의 user_info 조회
            const { data: userInfo, error } = await supabase
                .from('user_info')
                .select('timezone')
                .eq('user_id', userId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') {
                alarmLogger('user_info 조회 오류', { error: error.message, userId });
                return;
            }

            // user_info가 없거나 timezone이 null인 경우
            if (!userInfo || !userInfo.timezone) {
                const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                alarmLogger('user_info timezone 업데이트 필요', {
                    userId: userId.substring(0, 8) + '...',
                    currentTimezone,
                    existingUserInfo: !!userInfo,
                    existingTimezone: userInfo?.timezone,
                });

                // user_info 업데이트 또는 생성
                const { error: upsertError } = await supabase.from('user_info').upsert(
                    {
                        user_id: userId,
                        timezone: currentTimezone,
                    },
                    { onConflict: 'user_id' }
                );

                if (upsertError) {
                    alarmLogger('user_info timezone 업데이트 실패', {
                        error: upsertError.message,
                        userId: userId.substring(0, 8) + '...',
                    });
                    captureException(upsertError);
                } else {
                    alarmLogger('user_info timezone 업데이트 성공', {
                        userId: userId.substring(0, 8) + '...',
                        timezone: currentTimezone,
                    });
                }
            } else {
                alarmLogger('user_info timezone 이미 설정됨', {
                    userId: userId.substring(0, 8) + '...',
                    timezone: userInfo.timezone,
                });
            }
        } catch (error) {
            alarmLogger('user_info timezone 확인 중 예외 발생', {
                error: error instanceof Error ? error.message : 'Unknown error',
                userId: userId.substring(0, 8) + '...',
            });
        }
    };

    /**
     * 알람 활성화 처리
     */
    const handleAlarmActivation = async (previousAlarmActive: boolean) => {
        const summary = title + '\n\n' + body;
        alarmLogger('📝 알람 컨텐츠 요약 생성', {
            summaryLength: summary.length,
            title: title.substring(0, 30) + (title.length > 30 ? '...' : ''),
        });

        try {
            alarmLogger('🔔 알람 활성화 시작');

            // UI 상태를 즉시 전환 (낙관적 업데이트)
            setIsAlarmActive(true);

            // 리마인더 활성화 스낵바 표시
            openSnackbar({
                message: rt('reminder-started'),
                actionBtn: {
                    label: c('learn-more'),
                    onClick: () => {
                        openExternalLink(at('reminder-guide-url'));
                    },
                },
            });

            // 사용자 timezone 확인 및 업데이트
            if (userId) {
                await ensureUserTimezone(userId);
            }

            // 시작 시간 설정 (UTC 기준)
            const startTime = new Date().toISOString();

            alarmLogger('⏰ 알람 시간 설정', {
                startTime,
                interval: '24시간',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });

            alarmLogger('📝 알람 컨텐츠 처리', {
                originalTitleLength: title?.length || 0,
                originalBodyLength: body?.length || 0,
                hasHtml: /<[^>]*>/.test(title || '') || /<[^>]*>/.test(body || ''),
            });

            // watermelondb alarm 테이블에 저장
            const alarmCollection = database.collections.get<Alarm>('alarm');

            // 기존 알람이 있는지 확인
            const existingAlarms = await alarmCollection.query(Q.where('page_id', pageId)).fetch();

            if (existingAlarms.length === 0) {
                const id = ulid();
                // 새 알람 생성
                await database.write(async () => {
                    await alarmCollection.create((alarm) => {
                        alarm._raw.id = id;
                        alarm.user_id = userId || '';
                        alarm.page_id = pageId;
                        alarm.next_alarm_time = 0;
                        alarm.sent_count = 0;
                        alarm.last_notification_id = '';
                    });
                });

                // 리마인더 활성화 후 글목록 새로고침 트리거 (즉시 + 지연 재실행)
                try {
                    refreshList({
                        source: 'useAlarmFeatures:activation',
                        pageId,
                        action: 'update',
                    });
                    alarmLogger('🔄 리마인더 활성화 후 글목록 새로고침 트리거 발행', { pageId });
                } catch (e) {
                    // 새로고침 트리거 실패는 사용자 동작을 막지 않음
                    alarmLogger('⚠️ 글목록 새로고침 트리거 발행 실패 (무시)', {
                        pageId,
                        error: e instanceof Error ? e.message : 'Unknown error',
                    });
                }

                alarmLogger('✅ alarm watermelondb 생성 성공', {
                    id,
                    pageId,
                });

                // 서버와 동기화
                try {
                    await sync();
                    alarmLogger('✅ alarm 생성 후 동기화 성공', { id, pageId });
                } catch (syncError) {
                    alarmLogger('⚠️ alarm 생성 후 동기화 실패 (로컬 저장은 성공)', {
                        pageId,
                        error: syncError instanceof Error ? syncError.message : 'Unknown error',
                    });
                }
            } else {
                alarmLogger('✅ alarm이 이미 존재함', { pageId });
            }

            // 네이티브 앱 권한 요청
            try {
                alarmLogger('📱 네이티브 앱 권한 요청');
                webviewLogger('네이티브앱에 알람 활성화 요청');
                communicateWithAppsWithCallback('requestPushMessagePermissionToNative', {});
                alarmLogger('✅ 네이티브 앱 권한 요청 완료');
            } catch (error) {
                // 네이티브 앱 권한 요청 실패는 전체 플로우를 중단하지 않음
                alarmLogger('⚠️ 네이티브 앱 권한 요청 실패 (무시)', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                console.warn('네이티브 앱 권한 요청 실패 (계속 진행):', error);
            }
        } catch (error) {
            alarmLogger('🔄 알람 활성화 처리 실패, 상태 롤백', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            setIsAlarmActive(previousAlarmActive);
            openSnackbar({ message: '알람 정보 저장 중 오류가 발생했습니다.' });
            console.error('알람 활성화 처리 실패:', error);
        }
    };

    /**
     * 알람 삭제를 시도하는 함수 (리트라이 로직 포함)
     * @param pageId 삭제할 알람의 page_id
     * @param maxRetries 최대 재시도 횟수
     * @param retryDelay 재시도 간격 (밀리초)
     * @returns 삭제 성공 여부
     */
    const tryDeleteAlarm = async (
        pageId: string,
        maxRetries: number = 3,
        retryDelay: number = 1000
    ): Promise<boolean> => {
        let retryCount = 0;

        while (retryCount <= maxRetries) {
            try {
                if (retryCount > 0) {
                    alarmLogger(`🔄 알람 삭제 재시도 ${retryCount}/${maxRetries}`, { pageId });
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                }

                // watermelondb에서 알람 정보 삭제
                try {
                    const alarmCollection = database.collections.get<Alarm>('alarm');
                    const alarmsToDelete = await alarmCollection
                        .query(Q.where('page_id', pageId))
                        .fetch();

                    if (alarmsToDelete.length > 0) {
                        await database.write(async () => {
                            for (const alarm of alarmsToDelete) {
                                await alarm.markAsDeleted();
                            }
                        });

                        alarmLogger('✅ watermelondb 알람 삭제 성공', {
                            pageId,
                            deletedCount: alarmsToDelete.length,
                        });

                        // 서버와 동기화
                        try {
                            await sync();
                            alarmLogger('✅ alarm 삭제 후 동기화 성공', { pageId });
                        } catch (syncError) {
                            alarmLogger('⚠️ alarm 삭제 후 동기화 실패 (로컬 삭제는 성공)', {
                                pageId,
                                error:
                                    syncError instanceof Error
                                        ? syncError.message
                                        : 'Unknown error',
                            });
                        }
                    } else {
                        alarmLogger('⚠️ 삭제할 알람이 없음', { pageId });
                    }
                } catch (dbError) {
                    alarmLogger('⚠️ watermelondb 알람 삭제 예외 발생', {
                        pageId,
                        error: dbError instanceof Error ? dbError.message : 'Unknown error',
                        retryCount,
                    });
                    throw dbError; // 재시도를 위해 에러를 상위로 전파
                }

                return true;
            } catch (error) {
                retryCount++;
                const isLastRetry = retryCount > maxRetries;

                if (isLastRetry) {
                    // 최대 재시도 횟수 초과 시 로그만 남기고 false 반환
                    alarmLogger('❌ 알람 삭제 최종 실패 (다음 작업 계속 진행)', {
                        pageId,
                        retryCount,
                        maxRetries,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    console.warn('알람 삭제 최종 실패 (다음 작업 계속 진행):', error);
                    return false;
                } else {
                    // 재시도 가능한 경우 로그만 남기고 계속 진행
                    alarmLogger('⚠️ 알람 삭제 실패, 재시도 예정', {
                        pageId,
                        retryCount,
                        maxRetries,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }
        return false;
    };

    const handleAlarmDeactivation = async (previousAlarmActive: boolean) => {
        // UI 상태를 즉시 전환 (낙관적 업데이트)
        setIsAlarmActive(false);

        // 리마인더 비활성화 스낵바 표시
        openSnackbar({
            message: rt('reminder-stopped'),
        });

        // try-catch 블록 제거 (tryDeleteAlarm이 이미 모든 에러를 처리)
        alarmLogger('6️⃣ 알람 비활성화 시작', { pageId });

        // 리트라이 로직이 포함된 삭제 함수 호출
        const deleteSuccess = await tryDeleteAlarm(pageId);

        if (!deleteSuccess) {
            // 삭제 실패 시에도 로그만 남기고 계속 진행
            alarmLogger('⚠️ 알람 삭제 실패 (무시하고 계속 진행)', {
                pageId,
                note: '최대 재시도 횟수 초과, 다음 작업 계속 진행',
            });
        }

        // 리마인더 비활성화 후에도 글목록 새로고침 트리거 (리마인더 목록에서 제거 반영)
        try {
            refreshList({
                source: 'useAlarmFeatures:deactivation',
                pageId,
                action: 'update',
            });
            alarmLogger('🔄 리마인더 비활성화 후 글목록 새로고침 트리거 발행', { pageId });
        } catch (e) {
            alarmLogger('⚠️ 글목록 새로고침 트리거 발행 실패 (무시)', {
                pageId,
                error: e instanceof Error ? e.message : 'Unknown error',
            });
        }
    };

    /**
     * 알람 클릭 핸들러 함수 (낙관적 업데이트 적용)
     */
    const handleAlarmClick = async () => {
        if (!pageId) {
            alarmLogger('pageId가 없어서 알람 클릭 처리 건너뜀');
            return;
        }

        if (!userId) {
            alarmLogger('userId가 없어서 알람 클릭 처리 건너뜀');
            return;
        }

        if (!title && !body) {
            alarmLogger('제목과 본문이 모두 비어있어서 알람 설정 불가');
            openSnackbar({ message: '제목이나 본문을 입력한 후 알람을 설정해주세요.' });
            return;
        }

        alarmLogger('🔔 알람 클릭 핸들러 시작', {
            pageId,
            currentAlarmActive: isAlarmActive,
            titleLength: title?.length || 0,
            bodyLength: body?.length || 0,
            action: isAlarmActive ? '비활성화' : '활성화',
        });

        // 현재 알람 상태 저장
        const previousAlarmActive = isAlarmActive;

        // 알람 켤 때만 슈퍼유저 체크
        if (!previousAlarmActive) {
            const isSuperuser = await checkIsSuperuser();
            if (!isSuperuser) {
                if (process.env.NODE_ENV === 'development') {
                    // 개발 환경에서는 사용자 ID 포함한 자세한 안내
                    const currentUserId = await fetchUserId('useAlarmFeatures');
                    openConfirm({
                        message: `[개발 모드] 리마인더 기능은 슈퍼유저만 사용할 수 있습니다.\n\nsuperuser 테이블에 아래 계정을 추가해주세요:\n${currentUserId}`,
                        yesLabel: '확인',
                        noLabel: '',
                        onYes: () => {},
                        onNo: null,
                    });
                    return;
                } else {
                    // 프로덕션 환경에서는 기존 메시지
                    alarmLogger('프로덕션 환경에서 일반 사용자 - 준비중 메시지 표시');
                    openConfirm({
                        message: '준비 중입니다. 곧 공개하겠습니다!',
                        yesLabel: '확인',
                        noLabel: '',
                        onYes: () => {},
                        onNo: null,
                    });
                    return;
                }
            } else {
                alarmLogger('superuser - 리마인더 기능 허용');
            }
        }

        if (!previousAlarmActive) {
            // 리마인더 활성화 로직
            await handleAlarmActivation(previousAlarmActive);
        } else {
            // 리마인더 비활성화 로직
            await handleAlarmDeactivation(previousAlarmActive);
        }
    };

    return {
        isAlarmActive,
        handleAlarmClick,
    };
}
