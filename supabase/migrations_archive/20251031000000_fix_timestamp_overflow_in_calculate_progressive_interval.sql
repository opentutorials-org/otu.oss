-- calculate_progressive_interval 함수의 timestamp overflow 문제 수정
--
-- 문제:
-- 1. sent_count가 비정상적으로 큰 값(10 이상)일 때 타임스탬프 오버플로우 발생
--    예: sent_count=20이면 2^19 = 524,288일 (약 1,436년) 추가
-- 2. 비정상적으로 먼 미래의 next_alarm_time이 있을 경우 overflow 발생
--
-- 해결책:
-- 1. sent_count는 process_alarms_atomically에서 9로 제한됨 (2^8 = 256일)
-- 2. base_time이 1년 이상 미래면 현재 시간으로 보정
-- 3. 계산 결과가 1년을 초과하면 현재 + 256일로 제한
-- 4. 안전장치: 계산 중 overflow 발생 시 에러 처리

CREATE OR REPLACE FUNCTION calculate_progressive_interval(
    p_base_time TIMESTAMP WITH TIME ZONE,
    p_sent_count INT,
    p_now TIMESTAMP WITH TIME ZONE
) RETURNS TIMESTAMP WITH TIME ZONE AS $$

DECLARE
    v_base_time TIMESTAMP WITH TIME ZONE;
    v_days_to_add INT;
    v_expected_time TIMESTAMP WITH TIME ZONE;
    v_one_year_from_now TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1년 후 기준점 계산
    v_one_year_from_now := p_now + INTERVAL '1 year';

    -- base_time 초기화
    v_base_time := COALESCE(p_base_time, p_now);

    -- 안전장치 1: base_time이 1년 이상 미래라면 현재 시간으로 보정
    IF v_base_time > v_one_year_from_now THEN
        RAISE WARNING 'base_time이 너무 먼 미래입니다. 현재 시간으로 보정: base_time=%, now=%', v_base_time, p_now;
        v_base_time := p_now;
    END IF;

    -- 승수 간격 계산 (sent_count는 이미 9로 제한되어 있음, 최대 256일)
    v_days_to_add := power(2, p_sent_count - 1)::INT;

    RAISE DEBUG 'calculate_progressive_interval: p_base_time=%, p_sent_count=%, p_now=%, v_days_to_add=%',
        p_base_time, p_sent_count, p_now, v_days_to_add;

    -- 과거 시간 보정
    IF v_base_time < p_now THEN
        RAISE DEBUG 'base_time이 과거입니다. 현재 시간으로 보정';
        v_base_time := p_now;
    END IF;

    -- 안전장치 2: 날짜 추가 시도 (overflow 예외 처리)
    -- PostgreSQL timestamp 범위: 4713 BC to 294276 AD
    BEGIN
        v_expected_time := v_base_time + (v_days_to_add || ' days')::INTERVAL;

        -- 안전장치 3: 계산 결과가 1년 이상 미래라면 제한 (비정상 데이터 보호)
        IF v_expected_time > v_one_year_from_now THEN
            RAISE WARNING 'calculated time이 1년을 초과합니다. 제한 적용: calculated=%, limit=%',
                v_expected_time, v_one_year_from_now;
            -- 1년 이상 미래는 현재 + 256일로 제한
            v_expected_time := p_now + INTERVAL '256 days';
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- overflow나 기타 에러 발생 시 안전한 기본값 사용
        RAISE WARNING 'timestamp 계산 중 오류 발생: %, SQLSTATE: %. 기본값(현재 + 256일) 사용', SQLERRM, SQLSTATE;
        v_expected_time := p_now + INTERVAL '256 days';
    END;

    -- 정각으로 설정
    v_expected_time := date_trunc('hour', v_expected_time);

    RAISE DEBUG 'calculate_progressive_interval: returning %', v_expected_time;
    RETURN v_expected_time;
END;

$$ LANGUAGE plpgsql;
