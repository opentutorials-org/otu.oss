CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() 
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
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