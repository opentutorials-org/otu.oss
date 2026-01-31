-- OneSignal 30일 제약을 우회하기 위한 알람 정책 업데이트
-- 1. 검색 조건을 변경하여 최초 알람과 1일 이내 알람을 모두 가져옴
-- 2. 알림 타입을 구분하여 즉시 전송/예약 전송/건너뛰기를 결정

-- 업데이트된 process_alarms_atomically 함수
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
    v_random_offset_hours INT;
    v_attempt_count INT;
    v_start_time TIMESTAMP WITH TIME ZONE;
    v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
    RAISE LOG 'process_alarms_atomically start: current_time=%, batch_limit=%', p_current_time, p_batch_limit;
    
    -- 처리 가능한 알람들을 한번에 조회하고 락 설정
    -- 변경된 WHERE 조건: 최초 알람(sent_count=1) 또는 1일 이내 예약된 알람
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
            ORDER BY sub.next_alarm_time ASC NULLS LAST
            LIMIT p_batch_limit
            FOR UPDATE SKIP LOCKED
        )
        RETURNING 
            a.page_id,
            a.user_id,
            a.next_alarm_time,
            a.sent_count,
            a.title,
            a.body,
            COALESCE((SELECT ui.timezone FROM user_info ui WHERE ui.user_id = a.user_id), 'Asia/Seoul') as user_timezone
    LOOP
        v_start_time := clock_timestamp();
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
            v_alarm.user_timezone
        );
        RAISE DEBUG 'After adjust_for_sleep_time: %', v_calculated_time;
        
        -- 3. 충돌 해결
        v_final_time := v_calculated_time;
        v_attempt_count := 0;
        
        WHILE v_attempt_count < 50 LOOP
            RAISE DEBUG 'Conflict attempt #% for alarm % at %', v_attempt_count, v_alarm.page_id, v_final_time;
            -- 충돌 확인
            IF NOT EXISTS (
                SELECT 1 FROM alarm a1
                WHERE a1.user_id = v_alarm.user_id 
                AND a1.next_alarm_time = v_final_time
                AND a1.page_id != v_alarm.page_id
            ) THEN
                EXIT; -- 충돌 없음
            END IF;
            
            -- 랜덤 오프셋 적용 (1~23시간)
            IF p_random_seed IS NOT NULL THEN
                v_random_offset_hours := 1 + floor(p_random_seed * 23)::INT;
            ELSE
                v_random_offset_hours := 1 + floor(random() * 23)::INT;
            END IF;
            v_final_time := v_final_time + (v_random_offset_hours || ' hours')::INTERVAL;
            v_final_time := adjust_for_sleep_time(v_final_time, v_alarm.user_timezone);
            
            v_attempt_count := v_attempt_count + 1;
        END LOOP;
        
        -- 충돌 해결 실패 시 1주일 뒤로
        IF v_attempt_count >= 50 THEN
            v_final_time := v_calculated_time + INTERVAL '7 days';
        END IF;
        
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
$$ LANGUAGE plpgsql;