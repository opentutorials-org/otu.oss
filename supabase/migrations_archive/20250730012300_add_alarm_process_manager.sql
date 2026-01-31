
-- 3. user_info join 최적화 인덱스
CREATE INDEX IF NOT EXISTS "idx_user_info_timezone" ON "public"."user_info" (user_id, timezone);

-- 4. 헬퍼 함수들
-- 4-1. 승수 간격 계산
CREATE OR REPLACE FUNCTION calculate_progressive_interval(
    p_base_time TIMESTAMP WITH TIME ZONE,
    p_sent_count INT,
    p_now TIMESTAMP WITH TIME ZONE
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_base_time TIMESTAMP WITH TIME ZONE;
    v_days_to_add INT;
    v_expected_time TIMESTAMP WITH TIME ZONE;
BEGIN
    v_base_time := COALESCE(p_base_time, p_now);
    v_days_to_add := power(2, p_sent_count - 1)::INT;
    v_expected_time := v_base_time + (v_days_to_add || ' days')::INTERVAL;
    RAISE DEBUG 'calculate_progressive_interval: p_base_time=%, p_sent_count=%, p_now=%, v_days_to_add=%, v_expected_time=%', p_base_time, p_sent_count, p_now, v_days_to_add, v_expected_time;
    
    -- 과거 시간 보정
    IF v_expected_time < p_now THEN
        v_base_time := p_now;
        v_expected_time := v_base_time + (v_days_to_add || ' days')::INTERVAL;
    END IF;
    
    -- 정각으로 설정
    RAISE DEBUG 'calculate_progressive_interval: returning %', date_trunc('hour', v_expected_time);
    RETURN date_trunc('hour', v_expected_time);
END;
$$ LANGUAGE plpgsql;

-- 4-2. 수면시간 조정
CREATE OR REPLACE FUNCTION adjust_for_sleep_time(
    p_time TIMESTAMP WITH TIME ZONE,
    p_timezone TEXT
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_local_hour INT;
    v_local_time TIMESTAMP;
    v_adjusted_time TIMESTAMP WITH TIME ZONE;
BEGIN
    RAISE DEBUG 'adjust_for_sleep_time: p_time=%, p_timezone=%', p_time, p_timezone;
    -- 사용자 시간대로 변환하여 시간 확인
    v_local_time := p_time AT TIME ZONE p_timezone;
    v_local_hour := EXTRACT(HOUR FROM v_local_time);
    
    -- 수면시간(22:00~07:00) 확인
    IF v_local_hour >= 22 OR v_local_hour < 7 THEN
        -- 다음날 7시로 조정
        IF v_local_hour >= 22 THEN
            v_adjusted_time := (v_local_time::DATE + INTERVAL '1 day' + INTERVAL '7 hours') AT TIME ZONE p_timezone;
        ELSE
            v_adjusted_time := (v_local_time::DATE + INTERVAL '7 hours') AT TIME ZONE p_timezone;
        END IF;
        RAISE DEBUG 'adjust_for_sleep_time: adjusted_time=%', v_adjusted_time;
        RETURN v_adjusted_time;
    END IF;
    
    RAISE DEBUG 'adjust_for_sleep_time: no adjustment, returning %', p_time;
    RETURN p_time;
END;
$$ LANGUAGE plpgsql;

-- 5. 메인 처리 함수 (테스트 주입 가능)
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
    FOR v_alarm IN 
        UPDATE alarm a
        SET processed_at = p_current_time
        WHERE a.page_id IN (
            SELECT sub.page_id
            FROM alarm sub
            WHERE (sub.next_alarm_time < p_current_time OR sub.next_alarm_time IS NULL)
            AND (sub.processed_at IS NULL OR sub.processed_at < p_current_time - INTERVAL '5 minutes')
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
        RAISE LOG 'Processing alarm: page_id=%, user_id=%', v_alarm.page_id, v_alarm.user_id;
        
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
            -- 테스트 환경에서는 예측 가능한 값 사용, 운영 환경에서는 실제 랜덤값 사용
            IF p_random_seed IS NOT NULL THEN
                -- 테스트 환경: 시드값을 직접 사용하여 예측 가능한 오프셋 계산
                v_random_offset_hours := 1 + floor(p_random_seed * 23)::INT;
            ELSE
                -- 운영 환경: 실제 랜덤값 사용
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
            sent_count = v_alarm.sent_count + 1,
            processed_at = NULL -- 처리 완료 후 락 해제
        WHERE a2.page_id = v_alarm.page_id;
        RAISE LOG 'Updated alarm: page_id=%, new_next_alarm_time=%, sent_count=%', v_alarm.page_id, v_final_time, v_alarm.sent_count + 1;
        
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