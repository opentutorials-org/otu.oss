CREATE OR REPLACE FUNCTION set_quota(
    p_user_id uuid,
    p_api_type_id int,
    p_usage_amount numeric,
    p_free_plan_limit numeric,
    p_subscription_plan_limit numeric
) RETURNS void AS $$
DECLARE
    v_api_price numeric;
    v_updated_quota numeric;
BEGIN
    -- API 가격을 가져옴
    SELECT price INTO STRICT v_api_price
    FROM api_type
    WHERE id = p_api_type_id;

    -- usage 테이블의 current_quota 및 status 업데이트
    UPDATE usage
    SET current_quota = current_quota + (v_api_price * p_usage_amount),
        status = CASE
                    WHEN current_quota + (v_api_price * p_usage_amount) >
                         CASE 
                             WHEN plan_type = 'FREE' THEN p_free_plan_limit 
                             ELSE p_subscription_plan_limit 
                         END
                    THEN CASE
                             WHEN plan_type = 'FREE' THEN 'INACTIVE_FREE_USAGE_EXCEEDED'::subscription_status
                             ELSE 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED'::subscription_status
                         END
                    ELSE status
                 END
    WHERE user_id = p_user_id
    RETURNING current_quota INTO v_updated_quota;

    -- 사용자 ID가 존재하지 않는 경우 예외 처리
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with ID % not found in usage table', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;