ALTER TABLE public.api_usage_statistic
DROP COLUMN month;

ALTER TYPE public.user_info_avaliable_status ADD VALUE 'INACTIVE_PAUSED';
ALTER TYPE public.user_info_avaliable_status ADD VALUE 'ACTIVE_BUT_CANCELLED';

ALTER TABLE public.user_info
ADD COLUMN current_quota numeric DEFAULT 0;

ALTER TABLE public.user_info
ADD COLUMN start_date text;
