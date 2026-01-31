ALTER TABLE public.api_type
ADD COLUMN call_price NUMERIC NOT NULL DEFAULT 0;

UPDATE public.api_type
SET 
    name = 'uploadcare-business-2024-11-14',
    price = 0.000439,
    call_price = 0.00574,
    description = '
    - business plan 기준
    - 오퍼레이션 비용 : 파일당 최대 3건 발생 → $0.00135
    - 스토리지 비용 : $0.000439/MB
    - 트래픽 비용 : 파일 마다 10회 다운로드 됨으로 가정 $0.00439',
    version = '2024-11-14'
WHERE 
    id = 23;

CREATE OR REPLACE FUNCTION set_quota(
    p_user_id uuid,
    p_api_type_id int,
    p_usage_amount numeric,
    p_free_plan_limit numeric,
    p_subscription_plan_limit numeric
) RETURNS void AS $$
DECLARE
    v_api_price numeric;
    v_api_call_price numeric;
    v_updated_quota numeric;
BEGIN
    -- API 가격을 가져옴
    SELECT price, call_price INTO STRICT v_api_price, v_api_call_price
    FROM api_type
    WHERE id = p_api_type_id;

    -- usage 테이블의 current_quota 및 status 업데이트
    UPDATE usage
    SET current_quota = current_quota + (v_api_price * p_usage_amount) + v_api_call_price,
        status = CASE
                    WHEN current_quota + (v_api_price * p_usage_amount) + v_api_call_price >
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

