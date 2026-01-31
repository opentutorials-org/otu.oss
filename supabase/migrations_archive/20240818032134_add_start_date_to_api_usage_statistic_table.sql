ALTER TABLE public.api_usage_statistic
ADD COLUMN start_date numeric not null;

CREATE INDEX idx_api_usage_statistic_user_id_start_date
ON public.api_usage_statistic (user_id, start_date);