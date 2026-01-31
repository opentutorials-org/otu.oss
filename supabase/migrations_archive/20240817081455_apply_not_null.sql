-- 1. public.subscriptions 테이블 개선
ALTER TABLE public.subscriptions
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN product_payment_type_price_id SET NOT NULL;

-- 2. public.user_info 테이블 개선
ALTER TABLE public.user_info
    ALTER COLUMN pay_type SET DEFAULT 'free'::pay_type,
    ALTER COLUMN is_fixed_charge SET DEFAULT false;

-- 3. public.product_payment_type 테이블 개선
ALTER TABLE public.product_payment_type
    ALTER COLUMN platform SET NOT NULL;

-- 4. public.product_payment_type_price 테이블 개선
ALTER TABLE public.product_payment_type_price
    ALTER COLUMN product_payment_type_id SET NOT NULL;

-- 5. public.api_type 테이블 개선
ALTER TABLE public.api_type
    ALTER COLUMN price SET NOT NULL,
    ALTER COLUMN currency SET NOT NULL;

-- 6. public.api_usage_raw 테이블 개선
ALTER TABLE public.api_usage_raw
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN api_type_id SET NOT NULL,
    ALTER COLUMN amount SET NOT NULL,
    ALTER COLUMN usage_purpose SET NOT NULL;


-- 7. public.api_usage_statistic 테이블 개선
ALTER TABLE public.api_usage_statistic
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN month SET NOT NULL;