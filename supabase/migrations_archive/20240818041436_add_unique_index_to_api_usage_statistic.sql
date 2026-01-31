drop index if exists idx_api_usage_statistic_user_id_start_date;

create unique index if not exists idx_api_usage_statistic_user_id_start_date_unique 
on public.api_usage_statistic using btree (user_id, start_date) tablespace pg_default;