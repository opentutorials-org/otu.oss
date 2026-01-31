-- calculate_progressive_interval 함수의 과거 시간 보정 로직 수정
-- 문제: 2일을 더한 후의 시간이 과거인지 확인하는 것이 아니라,
--       원래 next_alarm_time이 과거인지 먼저 확인해야 함

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
    IF v_base_time < p_now THEN  -- 현재 NAT(next_alarm_time)가 과거인지 먼저 확인
        v_base_time := p_now;
    END IF;
    v_expected_time := v_base_time + (v_days_to_add || ' days')::INTERVAL;
    
    -- 정각으로 설정
    RAISE DEBUG 'calculate_progressive_interval: returning %', date_trunc('hour', v_expected_time);
    RETURN date_trunc('hour', v_expected_time);
END;

$$ LANGUAGE plpgsql;
