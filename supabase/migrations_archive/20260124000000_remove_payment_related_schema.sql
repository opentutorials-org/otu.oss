-- =====================================================
-- 결제/구독 관련 DB 스키마 제거
-- 이슈: #1308 (오픈소스화 준비)
-- =====================================================

-- =====================================================
-- 1. 트리거 제거
-- =====================================================

-- usage_audit_trigger 제거 (usage 테이블에 연결된 감사 트리거)
DROP TRIGGER IF EXISTS usage_audit_trigger ON public.usage;

-- handle_subscriptions_updated_at 제거 (subscriptions 테이블에 연결된 updated_at 자동 갱신 트리거)
DROP TRIGGER IF EXISTS handle_subscriptions_updated_at ON public.subscriptions;

-- =====================================================
-- 2. 함수 제거
-- =====================================================

-- log_usage_changes 함수 제거 (usage_audit 트리거용)
DROP FUNCTION IF EXISTS public.log_usage_changes();

-- set_quota 함수 제거 (이미 increment_quota로 대체됨)
DROP FUNCTION IF EXISTS public.set_quota(uuid, text, numeric, numeric, numeric);

-- increment_quota 함수 제거 (사용량 계산 함수)
DROP FUNCTION IF EXISTS public.increment_quota(uuid, numeric, numeric, numeric);

-- =====================================================
-- 3. RLS 정책 제거 - subscriptions 테이블
-- =====================================================

DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.subscriptions;
DROP POLICY IF EXISTS "Enable insert for owner" ON public.subscriptions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.subscriptions;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.subscriptions;

-- =====================================================
-- 4. RLS 정책 제거 - usage 테이블
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for self" ON public.usage;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.usage;
DROP POLICY IF EXISTS "Allow service role to insert" ON public.usage;

-- =====================================================
-- 5. RLS 정책 제거 - usage_audit 테이블
-- =====================================================

DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public.usage_audit;

-- =====================================================
-- 6. 외래키 제약조건 제거 (테이블 삭제 전 필수)
-- =====================================================

-- order 테이블의 외래키 제거
ALTER TABLE IF EXISTS public."order" DROP CONSTRAINT IF EXISTS order_subscriptions_id_fkey;
ALTER TABLE IF EXISTS public."order" DROP CONSTRAINT IF EXISTS order_user_id_fkey;

-- subscriptions 테이블의 외래키 제거
ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_product_payment_type_price_id_fkey;
ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

-- prouduct_payment_type_price 테이블의 외래키 제거 (오타 포함된 원본 테이블명)
ALTER TABLE IF EXISTS public.prouduct_payment_type_price DROP CONSTRAINT IF EXISTS prouduct_payment_type_price_product_payment_type_id_fkey;

-- usage 테이블의 외래키 제거
ALTER TABLE IF EXISTS public.usage DROP CONSTRAINT IF EXISTS usage_user_id_fkey;

-- usage_audit 테이블의 외래키 제거
ALTER TABLE IF EXISTS public.usage_audit DROP CONSTRAINT IF EXISTS usage_audit_user_id_fkey;

-- =====================================================
-- 7. 테이블 삭제 (외래키 역순으로 삭제)
-- =====================================================

-- order 테이블 삭제
DROP TABLE IF EXISTS public."order" CASCADE;

-- subscriptions 테이블 삭제
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- prouduct_payment_type_price 테이블 삭제 (오타 포함된 원본 테이블명)
DROP TABLE IF EXISTS public.prouduct_payment_type_price CASCADE;

-- product_payment_type 테이블 삭제
DROP TABLE IF EXISTS public.product_payment_type CASCADE;

-- usage_audit 테이블 삭제
DROP TABLE IF EXISTS public.usage_audit CASCADE;

-- usage 테이블 삭제
DROP TABLE IF EXISTS public.usage CASCADE;

-- =====================================================
-- 8. ENUM 타입 삭제
-- =====================================================

-- 결제 관련 ENUM 타입들
DROP TYPE IF EXISTS public.currency CASCADE;
DROP TYPE IF EXISTS public.order_status CASCADE;
DROP TYPE IF EXISTS public.payment_cycle CASCADE;
DROP TYPE IF EXISTS public.pg CASCADE;

-- 구독 상태 관련 ENUM 타입들
DROP TYPE IF EXISTS public.subscription_status CASCADE;
DROP TYPE IF EXISTS public.subscription_plan CASCADE;
DROP TYPE IF EXISTS public.subscription_active_status CASCADE;

-- 기타 결제 관련 ENUM 타입들
DROP TYPE IF EXISTS public.store_type CASCADE;

-- =====================================================
-- 완료
-- =====================================================
