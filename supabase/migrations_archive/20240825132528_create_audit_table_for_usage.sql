CREATE TABLE public.usage_audit (
    audit_id serial PRIMARY KEY,
    user_id uuid NOT NULL,
    current_quota numeric(15, 11) NULL,
    status public.subscription_status NOT NULL,
    plan_type public.subscription_plan NOT NULL,
    last_reset_date date NOT NULL,
    next_reset_date date NOT NULL,
    store public.store_type NULL,
    data jsonb NULL,
    premium_expires_date timestamp with time zone NULL,
    premium_grace_period_expires_date timestamp with time zone NULL,
    premium_product_identifier text NULL,
    premium_purchase_date timestamp with time zone NULL,
    premium_product_plan_identifier text NULL,
    is_subscription_canceled boolean NULL,
    changed_at timestamp with time zone NOT NULL DEFAULT now(),
    operation_type text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE' 등의 작업 종류
    constraint usage_audit_user_id_fkey foreign key (user_id) references auth.users (id)
) TABLESPACE pg_default;


CREATE OR REPLACE FUNCTION public.log_usage_changes() 
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;


CREATE TRIGGER usage_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.usage
FOR EACH ROW EXECUTE FUNCTION public.log_usage_changes();