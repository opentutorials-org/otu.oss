-- title, body, start_time을 alarm에서 제거하고 page와 join 방식으로 변경


-- 수정된 process_alarms_atomically 함수: page 테이블과 join 방식

CREATE OR REPLACE FUNCTION process_alarms_atomically(
    p_current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_batch_limit INT DEFAULT 100,
    p_random_seed DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE(
    page_id TEXT,
    user_id UUID,
    old_next_alarm_time TIMESTAMP WITH TIME ZONE,
    new_next_alarm_time TIMESTAMP WITH TIME ZONE,
    sent_count INT,
    title TEXT,
    body TEXT,
    timezone TEXT,
    processing_time_ms INT
) AS $$
DECLARE
    v_alarm RECORD;
    v_calculated_time TIMESTAMP WITH TIME ZONE;
    v_final_time TIMESTAMP WITH TIME ZONE;
    v_start_time TIMESTAMP WITH TIME ZONE;
    v_end_time TIMESTAMP WITH TIME ZONE;
    v_page_title TEXT;
    v_page_body TEXT;
    v_user_timezone TEXT;
BEGIN
    RAISE LOG 'process_alarms_atomically start: current_time=%, batch_limit=%', p_current_time, p_batch_limit;
    
    -- 처리 가능한 알람들을 한번에 조회하고 락 설정
    -- 성능 최적화: page와 LEFT JOIN으로 데이터 무결성 보장
    FOR v_alarm IN 
        UPDATE alarm a
        SET processed_at = p_current_time
        WHERE a.page_id IN (
            SELECT sub.page_id
            FROM alarm sub
            WHERE (
                -- 최초 구독 알람
                (sub.sent_count = 1) OR
                -- 12시간 이내 예약된 알람 (중복 처리 방지)
                (sub.next_alarm_time - INTERVAL '12 hours' < p_current_time)
            )
            AND (sub.processed_at IS NULL OR sub.processed_at < p_current_time - INTERVAL '6 hours')
            -- 성능 최적화: page가 존재하는 알람만 처리 (JOIN 조건 사전 필터링)
            AND EXISTS (
                SELECT 1 FROM page p WHERE p.id = sub.page_id
            )
            ORDER BY sub.next_alarm_time ASC NULLS LAST
            LIMIT p_batch_limit
            FOR UPDATE SKIP LOCKED
        )
        RETURNING 
            a.page_id,
            a.user_id,
            a.next_alarm_time,
            a.sent_count
    LOOP
        v_start_time := clock_timestamp();
        
        -- page 데이터를 별도로 조회 (락 경합 최소화)
        SELECT 
            COALESCE(p.title, '') as page_title,
            COALESCE(p.body, '') as page_body,
            COALESCE((SELECT ui.timezone FROM user_info ui WHERE ui.user_id = v_alarm.user_id), 'Asia/Seoul') as user_timezone
        INTO v_page_title, v_page_body, v_user_timezone
        FROM page p
        WHERE p.id = v_alarm.page_id;
        
        -- page가 삭제된 경우 건너뛰기
        IF NOT FOUND THEN
            RAISE WARNING 'Page not found for alarm: page_id=%, skipping', v_alarm.page_id;
            CONTINUE;
        END IF;
        
        RAISE LOG 'Processing alarm: page_id=%, user_id=%, sent_count=%, next_alarm_time=%', 
            v_alarm.page_id, v_alarm.user_id, v_alarm.sent_count, v_alarm.next_alarm_time;
        
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
            v_user_timezone
        );
        RAISE DEBUG 'After adjust_for_sleep_time: %', v_calculated_time;
        
        -- 3. 충돌 해결 (함수화된 로직 사용)
        v_final_time := resolve_alarm_time_conflict(
            v_calculated_time,
            v_alarm.user_id,
            v_alarm.page_id,
            v_user_timezone,
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
        
        -- 5. 결과 반환 (title, body는 page에서 가져온 값)
        RETURN QUERY SELECT 
            v_alarm.page_id,
            v_alarm.user_id,
            v_alarm.next_alarm_time,
            v_final_time,
            v_alarm.sent_count + 1,
            v_page_title,
            v_page_body,
            v_user_timezone,
            EXTRACT(MILLISECOND FROM (v_end_time - v_start_time))::INT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;