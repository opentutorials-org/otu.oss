ALTER TABLE public.usage_audit
ADD COLUMN is_subscription_paused BOOLEAN NULL DEFAULT FALSE;