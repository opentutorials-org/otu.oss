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
        -- current_quota를 제외한 나머지 컬럼의 값이 변했는지 확인
        IF (ROW(NEW.user_id, NEW.status, NEW.plan_type, NEW.last_reset_date, NEW.next_reset_date, NEW.store, 
               NEW.data, NEW.premium_expires_date, NEW.premium_grace_period_expires_date, NEW.premium_product_identifier, 
               NEW.premium_purchase_date, NEW.premium_product_plan_identifier, NEW.is_subscription_canceled)
            IS NOT DISTINCT FROM
            ROW(OLD.user_id, OLD.status, OLD.plan_type, OLD.last_reset_date, OLD.next_reset_date, OLD.store, 
                OLD.data, OLD.premium_expires_date, OLD.premium_grace_period_expires_date, OLD.premium_product_identifier, 
                OLD.premium_purchase_date, OLD.premium_product_plan_identifier, OLD.is_subscription_canceled)) THEN
            RETURN NEW; -- 변화가 없으면 로그를 남기지 않고 바로 리턴
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


