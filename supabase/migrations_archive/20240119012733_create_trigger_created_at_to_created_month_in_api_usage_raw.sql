set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_created_month()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- created_at의 연도와 월을 추출하고 일을 '1'로 설정하여 created_month에 할당
    NEW.created_month := date_trunc('month', NEW.created_at)::date;
    RETURN NEW;
END;
$function$
;

CREATE TRIGGER trigger_set_created_month BEFORE INSERT ON public.api_usage_raw FOR EACH ROW EXECUTE FUNCTION set_created_month();


