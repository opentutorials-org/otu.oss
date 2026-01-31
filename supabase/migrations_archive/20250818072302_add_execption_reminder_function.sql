-- 예외 처리가 추가된 알람 처리 함수
-- 오류가 발생한 알람도 error_reason과 함께 반환하여 애플리케이션 레벨에서 처리

-- 기존 함수 삭제 (반환 타입 변경을 위해 필요)
DROP FUNCTION IF EXISTS "public"."process_alarms_atomically"(timestamp with time zone, integer, double precision);

-- 새로운 함수 생성 (error_reason 컬럼 추가)
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
    "processing_time_ms" integer,
    "error_reason" "text"
)
LANGUAGE "plpgsql"
AS $$
DECLARE
    v_alarm RECORD;
    v_calculated_time TIMESTAMP WITH TIME ZONE;
    v_final_time TIMESTAMP WITH TIME ZONE;
    v_start_time TIMESTAMP WITH TIME ZONE;
    v_end_time TIMESTAMP WITH TIME ZONE;
    v_normalized_sent_count integer;
BEGIN
    RAISE LOG 'process_alarms_atomically start: current_time=%, batch_limit=%', p_current_time, p_batch_limit;
    
    -- 단순화된 조건으로 처리 가능한 알람들을 조회하고 락 설정
    -- NAT <= 현재 + 12시간인 모든 알람을 처리 (좀비 데이터 구제 포함)
    FOR v_alarm IN 
        UPDATE alarm a
        SET processed_at = p_current_time
        FROM (
            SELECT 
                sub.page_id,
                sub.id as alarm_id,
                sub.user_id,
                sub.next_alarm_time,
                sub.sent_count,
                LEFT(p.title, 2000) as title,
                LEFT(p.body, 2000) as body,
                COALESCE(ui.timezone, 'Asia/Seoul') as user_timezone
            FROM alarm sub
            LEFT JOIN page p ON p.id = sub.page_id
            LEFT JOIN user_info ui ON ui.user_id = sub.user_id
            WHERE 
                (sub.next_alarm_time <= p_current_time + INTERVAL '12 hours' OR sub.sent_count = 1)
                -- 중복 처리 방지 (6시간 이내 처리된 것은 제외)
                AND (sub.processed_at IS NULL OR sub.processed_at < p_current_time - INTERVAL '6 hours')
            ORDER BY sub.next_alarm_time ASC NULLS LAST
            LIMIT p_batch_limit
            FOR UPDATE OF sub
        ) target_data
        WHERE a.page_id = target_data.page_id
        RETURNING 
            target_data.alarm_id as id,          -- alarm.id
            target_data.page_id,
            target_data.user_id,
            target_data.next_alarm_time,
            target_data.sent_count,
            -- JOIN으로 가져온 데이터 사용 (2000자 제한)
            target_data.title,
            target_data.body,
            target_data.user_timezone
    LOOP
        -- 개별 알람 처리를 예외 처리 블록으로 감싸기
        BEGIN
            v_start_time := clock_timestamp();
            v_normalized_sent_count := LEAST(v_alarm.sent_count, 9);
            RAISE LOG 'Processing alarm: alarm_id=%, page_id=%, user_id=%, sent_count=%, next_alarm_time=%', 
                v_alarm.id, v_alarm.page_id, v_alarm.user_id, v_alarm.sent_count, v_alarm.next_alarm_time;
            
            -- 1. 승수 간격 계산 (과거 시간 보정 포함)
            v_calculated_time := calculate_progressive_interval(
                v_alarm.next_alarm_time, 
                v_normalized_sent_count,
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
            
            -- 4. 원자적 업데이트 (성공 시 processed_at은 유지 - 6시간 제한)
            UPDATE alarm 
            SET next_alarm_time = v_final_time,
                sent_count = v_normalized_sent_count + 1
            WHERE alarm.page_id = v_alarm.page_id;
            RAISE LOG 'Updated alarm: page_id=%, new_next_alarm_time=%, sent_count=%', 
                v_alarm.page_id, v_final_time, v_normalized_sent_count + 1;
            
            v_end_time := clock_timestamp();
            RAISE DEBUG 'Processing time (ms) = %', EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))::INT;
            
            -- 5. 성공한 경우 결과 반환 (error_reason = NULL)
            RETURN QUERY SELECT 
                v_alarm.id,             
                v_alarm.page_id,
                v_alarm.user_id,
                v_alarm.next_alarm_time,
                v_final_time,
                v_normalized_sent_count + 1,
                v_alarm.title,
                v_alarm.body,
                v_alarm.user_timezone,
                EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))::INT,
                NULL::text; -- error_reason = NULL (성공)
                
        EXCEPTION 
            WHEN OTHERS THEN
                -- 오류 발생 시 상세 로깅
                RAISE LOG 'Alarm processing failed: page_id=%, user_id=%, sent_count=%, error=%, sqlstate=%', 
                    v_alarm.page_id, v_alarm.user_id, v_alarm.sent_count, SQLERRM, SQLSTATE;
                
                -- processed_at은 유지하여 6시간 후 재처리되도록 함 (무한 재시도 방지)
                
                v_end_time := clock_timestamp();
                
                -- 6. 실패한 경우도 결과 반환 (error_reason 포함)
                RETURN QUERY SELECT 
                    v_alarm.id,             
                    v_alarm.page_id,
                    v_alarm.user_id,
                    v_alarm.next_alarm_time,
                    v_alarm.next_alarm_time, -- new_next_alarm_time = old (변경되지 않음)
                    v_alarm.sent_count,      -- sent_count도 변경되지 않음
                    v_alarm.title,
                    v_alarm.body,
                    v_alarm.user_timezone,
                    EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))::INT,
                    SQLSTATE || ': ' || SQLERRM; -- error_reason (SQLSTATE + 오류 메시지)
                
                -- 다음 알람 계속 처리 (CONTINUE는 암시적)
        END;
    END LOOP;
END;
$$;