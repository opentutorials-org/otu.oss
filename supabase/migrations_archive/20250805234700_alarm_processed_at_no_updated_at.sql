-- alarm 테이블에서 processed_at 필드 수정 시 updated_at이 갱신되지 않도록 하는 트리거 함수
CREATE OR REPLACE FUNCTION "public"."update_alarm_updated_at_except_processed_at"() 
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    -- processed_at 필드만 변경된 경우 updated_at을 갱신하지 않음
    IF OLD.processed_at IS DISTINCT FROM NEW.processed_at 
       AND (OLD.updated_at IS NOT DISTINCT FROM NEW.updated_at OR NEW.updated_at IS NULL) THEN
        -- processed_at만 변경된 경우 updated_at을 현재 시간으로 설정하지 않음
        NEW.updated_at := OLD.updated_at;
        RETURN NEW;
    END IF;

    -- 다른 필드가 변경된 경우 기존 로직 적용
    -- 사용자가 명시적으로 updated_at을 설정한 경우 (NULL이 아닌 경우) 보존
    IF NEW.updated_at IS NOT NULL AND NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        -- 사용자가 직접 값을 설정한 경우는 유지
        RETURN NEW;
    END IF;

    -- 사용자가 updated_at을 설정하지 않았거나 NULL로 설정한 경우에만 NOW()로 설정
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS update_alarm_modified_time ON public.alarm;

-- 새로운 트리거 생성
CREATE TRIGGER update_alarm_modified_time 
    BEFORE UPDATE ON public.alarm 
    FOR EACH ROW 
    EXECUTE FUNCTION update_alarm_updated_at_except_processed_at(); 