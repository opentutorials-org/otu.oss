-- OneSignal notification ID 배치 업데이트 함수 (성능 최적화 버전)
-- 단일 UPDATE 문으로 여러 알람을 한 번에 업데이트하여 최대 성능 달성

CREATE OR REPLACE FUNCTION update_notification_ids_batch(
    p_notification_updates jsonb
) 
RETURNS TABLE(
    updated_count integer,
    failed_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_count integer;
    v_updated_count integer := 0;
    v_failed_count integer := 0;
    v_current_time timestamp with time zone := NOW();
BEGIN
    -- 입력 데이터 개수 확인
    v_total_count := jsonb_array_length(p_notification_updates);
    
    -- 빈 입력 처리
    IF v_total_count = 0 THEN
        RETURN QUERY SELECT 0, 0;
        RETURN;
    END IF;
    
    -- 단일 UPDATE 문으로 모든 알람을 한 번에 업데이트 (최적화된 성능)
    WITH update_data AS (
        SELECT 
            (elem->>'alarm_id')::text AS alarm_id,
            (elem->>'notification_id')::text AS notification_id
        FROM jsonb_array_elements(p_notification_updates) AS elem
        WHERE elem->>'alarm_id' IS NOT NULL 
        AND elem->>'notification_id' IS NOT NULL
        AND trim(elem->>'alarm_id') != ''
        AND trim(elem->>'notification_id') != ''
    ),
    updated_alarms AS (
        UPDATE alarm 
        SET 
            last_notification_id = update_data.notification_id,
            updated_at = v_current_time
        FROM update_data
        WHERE alarm.id = update_data.alarm_id
        RETURNING alarm.id
    )
    SELECT COUNT(*)::integer INTO v_updated_count FROM updated_alarms;
    
    -- 실패한 업데이트 개수 계산
    v_failed_count := v_total_count - v_updated_count;
    
    -- 성능상 중요하지 않은 경우에만 로깅 (조건부)
    IF v_failed_count > 0 OR v_total_count > 50 THEN
        RAISE LOG 'update_notification_ids_batch: total=%, updated=%, failed=%', 
            v_total_count, v_updated_count, v_failed_count;
    END IF;
    
    -- 결과 반환
    RETURN QUERY SELECT v_updated_count, v_failed_count;
END;
$$;

-- 권한 설정
GRANT EXECUTE ON FUNCTION update_notification_ids_batch(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION update_notification_ids_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION update_notification_ids_batch(jsonb) TO service_role;