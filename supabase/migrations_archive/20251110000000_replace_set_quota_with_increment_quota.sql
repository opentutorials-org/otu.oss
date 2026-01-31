-- 새로운 increment_quota 함수를 생성합니다.
-- 이 함수는 전달받은 amount만큼 current_quota를 증가시키고, 사용량 한도에 따라 status를 업데이트합니다.
CREATE OR REPLACE FUNCTION increment_quota(
    p_user_id uuid,
    p_amount numeric,
    p_free_plan_limit numeric,
    p_subscription_plan_limit numeric
)
RETURNS void AS $$
DECLARE
    v_updated_quota numeric;
BEGIN
    UPDATE usage
    SET current_quota = current_quota + p_amount,
        status = CASE
                    WHEN current_quota + p_amount >
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

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with ID % not found in usage table', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
