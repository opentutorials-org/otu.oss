CREATE UNIQUE INDEX unique_user_month ON public.api_usage_statistic USING btree (user_id, month);

alter table "public"."api_usage_statistic" add constraint "unique_user_month" UNIQUE using index "unique_user_month";


