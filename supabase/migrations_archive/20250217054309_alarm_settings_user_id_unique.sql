ALTER TABLE public.alarm_settings
ADD CONSTRAINT alarm_settings_user_id_key UNIQUE (user_id);