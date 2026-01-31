CREATE OR REPLACE FUNCTION public.create_usage_entry()
RETURNS trigger AS $$
BEGIN
  BEGIN
    INSERT INTO public.usage (
      user_id,
      current_quota,
      status,
      plan_type,
      last_reset_date,
      next_reset_date,
      is_subscription_canceled
    ) VALUES (
      NEW.id,
      0.00, -- 기본 사용량
      'ACTIVE', -- 기본 상태
      'FREE', -- 기본 플랜
      NOW(),
      NOW() + INTERVAL '30 days', -- 초기화 간격
      false
    );
    RAISE NOTICE 'Usage entry created for user_id: %', NEW.id;
  EXCEPTION WHEN others THEN
    -- 에러 발생 시 경고 로그 출력
    RAISE WARNING 'Failed to create usage entry for user_id: % - %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;



CREATE TRIGGER usage_create_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_usage_entry();
