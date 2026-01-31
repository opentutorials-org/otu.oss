ALTER TABLE public.usage
ALTER COLUMN subscription_start_date DROP NOT NULL;

ALTER TABLE public.usage
ALTER COLUMN subscription_end_date DROP NOT NULL;