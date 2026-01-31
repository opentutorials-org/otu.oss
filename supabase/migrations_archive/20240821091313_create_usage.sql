-- ENUM 타입 정의
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'INACTIVE_EXPIRED_AUTO_RENEW_FAIL', 'INACTIVE_FREE_SUBSCRIPTION_USAGE_EXCEEDED');
CREATE TYPE subscription_plan AS ENUM ('FREE', 'MONTHLY', 'YEARLY');
CREATE TYPE platform_type AS ENUM ('IOS', 'ANDROID');

-- Usage 테이블 생성
CREATE TABLE usage (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid not null default auth.uid (),
    current_quota DECIMAL(10, 2) DEFAULT 0.00,
    reset_date DATE NOT NULL,
    status subscription_status NOT NULL,
    plan_type subscription_plan NOT NULL,
    platform platform_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    last_reset_date DATE NOT NULL,
    next_reset_date DATE NOT NULL,
    constraint usage_user_id_fkey foreign key (user_id) references auth.users (id)
);