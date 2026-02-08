/**
 * 리마인더 등록 API
 *
 * alarm 테이블 구조:
 * - page_id(PK), user_id, title, body (최대 2000자)
 * - next_alarm_time: 다음 알람 시간
 * - sent_count: 발송 횟수 (지수 백오프 계산용)
 * - processed_at: 동시성 제어 (6시간 초과 시 자동 복구)
 *
 * 동시성 제어: FOR UPDATE SKIP LOCKED로 행 단위 락
 * 중복 방지: resolve_alarm_time_conflict 함수, idempotency-key
 *
 * 디버깅: DEBUG='alarm' 또는 localStorage.debug='alarm'
 */
import { createClient } from '@/supabase/utils/server';
import { NextResponse } from 'next/server';
import { alarmLogger } from '@/debug/alarm';
import errorResponse from '@/functions/api/response';
import { v5 as uuidv5 } from 'uuid';

// 알람 고유 식별자 생성을 위한 네임스페이스
const ALARM_NAMESPACE = '550e8400-e29b-41d4-a716-446655440000';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
    let supabase: any = null;
    let page_id: string | null = null;

    try {
        // 요청 데이터 파싱
        const requestData = await request.json();
        page_id = requestData.page_id;
        const { title, body, timezone = 'Asia/Seoul' } = requestData;

        if (!page_id) {
            return errorResponse(
                {
                    status: 400,
                    errorCode: 'INVALID_REQUEST',
                    message: 'page_id is required',
                    data: {},
                },
                null
            );
        }

        supabase = await createClient();

        // 사용자 인증
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
            alarmLogger('사용자 인증 실패');
            return errorResponse(
                {
                    status: 401,
                    errorCode: 'UNAUTHORIZED',
                    message: '로그인 안 되어 있음',
                    data: {},
                },
                authError
            );
        }
        const currentUser = authData.user;
        alarmLogger('사용자 인증 성공', { user_id: currentUser.id });

        // alarm_settings 테이블이 삭제되었으므로 관련 로직 제거
        // 이제 alarm 테이블만 사용합니다.

        // 기존 알람 확인 (재등록 여부 판단용)
        const { data: existingAlarm, error: selectError } = await supabase
            .from('alarm')
            .select('id')
            .eq('page_id', page_id)
            .single();

        if (selectError && selectError.code !== 'PGRST116') {
            alarmLogger('알람 조회 에러:', selectError);
            throw selectError;
        }

        // 알람 재등록 시 sent_count를 0으로 리셋 (지수 백오프 주기 초기화)
        // "더 자주 알림" 기능이 정상 작동하려면 sent_count가 리셋되어야 합니다.
        const sentCount = 0;
        const currentTime = new Date();

        const alarmData = {
            user_id: currentUser.id,
            title: title || '알림',
            body: body || '',
            content: `${title}\n\n${body}` || '알림',
            start_time: currentTime.toISOString(),
            next_alarm_time: currentTime.toISOString(), // 현재 시간으로 설정
            page_id: page_id,
            sent_count: sentCount,
        };

        alarmLogger('알람 등록 시도:', {
            userId: currentUser.id,
            pageId: page_id,
            nextAlarmTime: currentTime.toISOString(),
            sentCount,
            isReregistration: !!existingAlarm,
        });

        // 알람 데이터 저장
        const { error: upsertError } = await supabase.from('alarm').upsert([alarmData], {
            onConflict: 'page_id',
            ignoreDuplicates: false,
        });

        if (upsertError) {
            alarmLogger('알람 데이터 등록 실패', { error: upsertError });
            throw upsertError;
        }

        alarmLogger('알람 등록 성공:', {
            nextAlarmTime: currentTime.toISOString(),
            sentCount,
        });

        return NextResponse.json({
            success: true,
            next_alarm_time: currentTime.toISOString(),
            sent_count: sentCount,
        });
    } catch (error: any) {
        alarmLogger('알람 등록 실패:', error);

        return NextResponse.json(
            {
                error: error.message || 'Failed to register alarm',
            },
            { status: 500 }
        );
    }
}

// 예약과 갱신을 같은 코드 베이스로 처리 고려
// 시간제약 (한시간, 주간)을 체크하는 로직이 한번만 실행되고 있음
//

// 예약
// NEXT_ALARM_TIME을 현재 시간으로 설정 => 끝

// 갱신 로직 작동
// NEXT_ALARM_TIME이 과거인 행을 조회 => 예약 & 만료 항목 검색
// 1시간 정각 시간을 만들고 주간 시간 중 중복되는 시간이 없는 가장 빠른 시간을 찾음.

// 해당 시간으로 예약 발송을 함.
// NEXT_ALAM_TIME을 주어진 시간으로 업데이트 (중복, 주간 체크 하지 않음)
