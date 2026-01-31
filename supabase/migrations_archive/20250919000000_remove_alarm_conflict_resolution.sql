-- 알람 처리 로직 개선: 데이터 정합성, 동시성, 성능 최적화
-- 1. (버그 수정) page_id 대신 기본 키 id를 사용하여 특정 알람만 정확히 업데이트
-- 2. (동시성) FOR UPDATE SKIP LOCKED를 추가하여 여러 워커의 동시 실행 시 교착 및 중복 처리 방지
-- 3. (정확성) 처리 시간 계산 방식을 EPOCH 기반으로 변경하여 전체 ms를 정확히 측정
-- 4. (타입 일관성) 반환 타입을 uuid에서 text로 되돌려 ulid와 호환되도록 수정
-- 5. (안정성) GREATEST 함수로 다음 알람 시간이 과거로 설정되지 않도록 보장
-- 6. (성능) 관련 컬럼에 인덱스 추가

-- 기존 함수 시그니처에 맞춰 모두 삭제
DROP FUNCTION IF EXISTS "public"."resolve_alarm_time_conflict"(timestamp with time zone, uuid, text, text, double precision, integer);
DROP FUNCTION IF EXISTS "public"."process_alarms_atomically"(timestamp with time zone, integer, double precision);
DROP FUNCTION IF EXISTS "public"."process_alarms_atomically"(timestamp with time zone, integer);


CREATE FUNCTION "public"."process_alarms_atomically"(
    "p_current_time" timestamp with time zone DEFAULT "now"(), 
    "p_batch_limit" integer DEFAULT 100
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
    
    FOR v_alarm IN 
        UPDATE public.alarm a
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
            FROM public.alarm sub
            LEFT JOIN public.page p ON p.id = sub.page_id
            LEFT JOIN public.user_info ui ON ui.user_id = sub.user_id
            WHERE 
                (sub.next_alarm_time <= p_current_time + INTERVAL '12 hours' OR sub.sent_count = 1)
                AND (sub.processed_at IS NULL OR sub.processed_at < p_current_time - INTERVAL '6 hours')
            ORDER BY sub.next_alarm_time ASC NULLS LAST
            LIMIT p_batch_limit
            FOR UPDATE OF sub SKIP LOCKED
        ) target_data
        WHERE a.id = target_data.alarm_id
        RETURNING 
            target_data.alarm_id as id,
            target_data.page_id,
            target_data.user_id,
            target_data.next_alarm_time,
            target_data.sent_count,
            target_data.title,
            target_data.body,
            target_data.user_timezone
    LOOP
        BEGIN
            v_start_time := clock_timestamp();
            v_normalized_sent_count := LEAST(v_alarm.sent_count, 9);
            
            v_calculated_time := calculate_progressive_interval(
                v_alarm.next_alarm_time, 
                v_normalized_sent_count,
                p_current_time
            );
            
            v_calculated_time := adjust_for_sleep_time(
                v_calculated_time, 
                v_alarm.user_timezone
            );

            -- 안전장치: 어떤 경우에도 알람 시간이 과거로 설정되지 않도록 보장
            v_final_time := GREATEST(
                v_calculated_time,
                p_current_time + INTERVAL '1 minute'
            );
            
            UPDATE public.alarm 
            SET next_alarm_time = v_final_time,
                sent_count = v_normalized_sent_count + 1
            WHERE id = v_alarm.id; -- ✅ 특정 알람만 정확히 업데이트
            
            v_end_time := clock_timestamp();
            
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
                FLOOR(1000 * EXTRACT(EPOCH FROM (v_end_time - v_start_time)))::INT,
                NULL::text;
                
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE LOG 'Alarm processing failed: alarm_id=%, page_id=%, user_id=%, sent_count=%, error=%, sqlstate=%', 
                    v_alarm.id, v_alarm.page_id, v_alarm.user_id, v_alarm.sent_count, SQLERRM, SQLSTATE;
                
                v_end_time := clock_timestamp();
                
                RETURN QUERY SELECT 
                    v_alarm.id,
                    v_alarm.page_id,
                    v_alarm.user_id,
                    v_alarm.next_alarm_time,
                    v_alarm.next_alarm_time,
                    v_alarm.sent_count,
                    v_alarm.title,
                    v_alarm.body,
                    v_alarm.user_timezone,
                    FLOOR(1000 * EXTRACT(EPOCH FROM (v_end_time - v_start_time)))::INT,
                    SQLSTATE || ': ' || SQLERRM;
        END;
    END LOOP;
END;
$$;

-- 성능 최적화를 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_alarm_next_time_processed_at ON alarm (next_alarm_time ASC, processed_at ASC) WHERE next_alarm_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alarm_sent_count_1 ON alarm (sent_count) WHERE sent_count = 1;
CREATE INDEX IF NOT EXISTS idx_alarm_processed_at ON alarm (processed_at);
