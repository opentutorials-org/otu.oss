-- process_alarms_atomically 함수에 alarm.id 추가
-- idempotency-key 생성을 위해 alarm.id가 필요함

-- 기존 함수 삭제 (반환 타입 변경을 위해 필요)
DROP FUNCTION IF EXISTS "public"."process_alarms_atomically"(timestamp with time zone, integer, double precision);

-- 새로운 함수 생성
CREATE FUNCTION "public"."process_alarms_atomically"(
    "p_current_time" timestamp with time zone DEFAULT "now"(), 
    "p_batch_limit" integer DEFAULT 100, 
    "p_random_seed" double precision DEFAULT NULL::double precision
) RETURNS TABLE(
    "alarm_id" "text",
    "page_id" "text", 
    "user_id" "uuid", 
    "old_next_alarm_time" timestamp with time zone, 
    "new_next_alarm_time" timestamp with time zone, 
    "sent_count" integer, 
    "title" "text", 
    "body" "text", 
    "timezone" "text", 
    "processing_time_ms" integer
)
LANGUAGE "plpgsql"
AS $$
DECLARE
    v_alarm RECORD;
    v_calculated_time TIMESTAMP WITH TIME ZONE;
    v_final_time TIMESTAMP WITH TIME ZONE;
    v_start_time TIMESTAMP WITH TIME ZONE;
    v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
    RAISE LOG 'process_alarms_atomically start: current_time=%, batch_limit=%', p_current_time, p_batch_limit;
    
    -- 처리 가능한 알람들을 한번에 조회하고 락 설정 (최적화된 버전)
    -- JOIN을 사용하여 개별 SELECT 최적화
    FOR v_alarm IN 
        UPDATE alarm a
        SET processed_at = p_current_time
        FROM (
            SELECT 
                sub.page_id,
                LEFT(p.title, 2000) as title,
                LEFT(p.body, 2000) as body,
                COALESCE(ui.timezone, 'Asia/Seoul') as user_timezone
            FROM alarm sub
            LEFT JOIN page p ON p.id = sub.page_id
            LEFT JOIN user_info ui ON ui.user_id = sub.user_id
            WHERE (
                -- 최초 구독 알람
                (sub.sent_count = 1) OR
                -- 현재 보다 12시간 이후 부터 조회 (13시간 전 X, 11시간 전 O, 1시간 후 O)
                (sub.next_alarm_time + INTERVAL '12 hours' > p_current_time)
            )
            AND (sub.processed_at IS NULL OR sub.processed_at < p_current_time - INTERVAL '6 hours')
            ORDER BY sub.next_alarm_time ASC NULLS LAST
            LIMIT p_batch_limit
            FOR UPDATE OF sub
        ) target_data
        WHERE a.page_id = target_data.page_id
        RETURNING 
            a.id,          -- alarm.id 추가
            a.page_id,
            a.user_id,
            a.next_alarm_time,
            a.sent_count,
            -- JOIN으로 가져온 데이터 사용 (2000자 제한)
            target_data.title,
            target_data.body,
            target_data.user_timezone
    LOOP
        v_start_time := clock_timestamp();
        RAISE LOG 'Processing alarm: alarm_id=%, page_id=%, user_id=%, sent_count=%, next_alarm_time=%', 
            v_alarm.id, v_alarm.page_id, v_alarm.user_id, v_alarm.sent_count, v_alarm.next_alarm_time;
        
        -- 1. 승수 간격 계산
        v_calculated_time := calculate_progressive_interval(
            v_alarm.next_alarm_time, 
            v_alarm.sent_count,
            p_current_time
        );
        RAISE DEBUG 'After calculate_progressive_interval: %', v_calculated_time;
        
        -- 2. 수면시간 조정
        v_calculated_time := adjust_for_sleep_time(
            v_calculated_time, 
            v_alarm.user_timezone
        );
        RAISE DEBUG 'After adjust_for_sleep_time: %', v_calculated_time;
        
        -- 3. 충돌 해결 (함수화된 로직 사용)
        v_final_time := resolve_alarm_time_conflict(
            v_calculated_time,
            v_alarm.user_id,
            v_alarm.page_id,
            v_alarm.user_timezone,
            p_random_seed,
            50 -- 최대 시도 횟수
        );
        RAISE DEBUG 'After resolve_alarm_time_conflict: %', v_final_time;
        
        -- 4. 원자적 업데이트
        UPDATE alarm a2
        SET next_alarm_time = v_final_time,
            sent_count = v_alarm.sent_count + 1
        WHERE a2.page_id = v_alarm.page_id;
        RAISE LOG 'Updated alarm: page_id=%, new_next_alarm_time=%, sent_count=%', 
            v_alarm.page_id, v_final_time, v_alarm.sent_count + 1;
        
        v_end_time := clock_timestamp();
        RAISE DEBUG 'Processing time (ms) = %', EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))::INT;
        
        -- 5. 결과 반환 
        RETURN QUERY SELECT 
            v_alarm.id,             
            v_alarm.page_id,
            v_alarm.user_id,
            v_alarm.next_alarm_time,
            v_final_time,
            v_alarm.sent_count + 1,
            v_alarm.title,
            v_alarm.body,
            v_alarm.user_timezone,
            EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))::INT;
    END LOOP;
END;
$$;