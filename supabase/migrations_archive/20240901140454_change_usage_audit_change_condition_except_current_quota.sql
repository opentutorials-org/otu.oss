set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.log_usage_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.usage_audit
        SELECT 
            NEXTVAL('usage_audit_audit_id_seq'), -- audit_id 값 자동 생성
            OLD.*, -- 기존 값 전체 삽입
            now(), -- 변경 시각
            'DELETE'; -- 작업 종류

        RETURN OLD;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        -- current_quota 값이 변하지 않았을 때만 기록
        IF NEW.current_quota IS DISTINCT FROM OLD.current_quota THEN
            RETURN NEW; -- 변화가 있으면 로그를 남기지 않고 바로 리턴
        END IF;

        INSERT INTO public.usage_audit
        SELECT 
            NEXTVAL('usage_audit_audit_id_seq'), 
            NEW.*,
            now(),
            'UPDATE';

        RETURN NEW;

    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.usage_audit
        SELECT 
            NEXTVAL('usage_audit_audit_id_seq'), 
            NEW.*,
            now(),
            'INSERT';

        RETURN NEW;
    END IF;
END;
$function$
;


