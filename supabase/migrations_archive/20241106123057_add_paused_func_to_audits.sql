CREATE OR REPLACE FUNCTION public.log_usage_changes() 
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- DELETE 처리
        INSERT INTO public.usage_audit (
            user_id, current_quota, status, plan_type, last_reset_date, next_reset_date, store, data, 
            premium_expires_date, premium_grace_period_expires_date, premium_product_identifier, 
            premium_purchase_date, premium_product_plan_identifier, is_subscription_canceled, 
            is_subscription_paused, changed_at, operation_type
        )
        VALUES (
            OLD.user_id, OLD.current_quota, OLD.status, OLD.plan_type, OLD.last_reset_date, OLD.next_reset_date, OLD.store, OLD.data, 
            OLD.premium_expires_date, OLD.premium_grace_period_expires_date, OLD.premium_product_identifier, 
            OLD.premium_purchase_date, OLD.premium_product_plan_identifier, OLD.is_subscription_canceled,
            OLD.is_subscription_paused, now(), 'DELETE'
        );

        RETURN OLD;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- 특정 컬럼을 제외하고 나머지 컬럼이 변경되었는지 확인
        IF (ROW(NEW.user_id, NEW.status, NEW.plan_type, NEW.last_reset_date, NEW.next_reset_date, NEW.store, 
               NEW.data, NEW.premium_expires_date, NEW.premium_grace_period_expires_date, NEW.premium_product_identifier, 
               NEW.premium_purchase_date, NEW.premium_product_plan_identifier, NEW.is_subscription_canceled, 
               NEW.is_subscription_paused)
            IS NOT DISTINCT FROM
            ROW(OLD.user_id, OLD.status, OLD.plan_type, OLD.last_reset_date, OLD.next_reset_date, OLD.store, 
                OLD.data, OLD.premium_expires_date, OLD.premium_grace_period_expires_date, OLD.premium_product_identifier, 
                OLD.premium_purchase_date, OLD.premium_product_plan_identifier, OLD.is_subscription_canceled, 
                OLD.is_subscription_paused)) THEN
            RETURN NEW; -- 변화가 없으면 로그를 남기지 않고 바로 리턴
        END IF;

        INSERT INTO public.usage_audit (
            user_id, current_quota, status, plan_type, last_reset_date, next_reset_date, store, data, 
            premium_expires_date, premium_grace_period_expires_date, premium_product_identifier, 
            premium_purchase_date, premium_product_plan_identifier, is_subscription_canceled, 
            is_subscription_paused, changed_at, operation_type
        )
        VALUES (
            NEW.user_id, NEW.current_quota, NEW.status, NEW.plan_type, NEW.last_reset_date, NEW.next_reset_date, NEW.store, NEW.data, 
            NEW.premium_expires_date, NEW.premium_grace_period_expires_date, NEW.premium_product_identifier, 
            NEW.premium_purchase_date, NEW.premium_product_plan_identifier, NEW.is_subscription_canceled,
            NEW.is_subscription_paused, now(), 'UPDATE'
        );

        RETURN NEW;

    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.usage_audit (
            user_id, current_quota, status, plan_type, last_reset_date, next_reset_date, store, data, 
            premium_expires_date, premium_grace_period_expires_date, premium_product_identifier, 
            premium_purchase_date, premium_product_plan_identifier, is_subscription_canceled, 
            is_subscription_paused, changed_at, operation_type
        )
        VALUES (
            NEW.user_id, NEW.current_quota, NEW.status, NEW.plan_type, NEW.last_reset_date, NEW.next_reset_date, NEW.store, NEW.data, 
            NEW.premium_expires_date, NEW.premium_grace_period_expires_date, NEW.premium_product_identifier, 
            NEW.premium_purchase_date, NEW.premium_product_plan_identifier, NEW.is_subscription_canceled,
            NEW.is_subscription_paused, now(), 'INSERT'
        );

        RETURN NEW;
    END IF;
END;
$$;