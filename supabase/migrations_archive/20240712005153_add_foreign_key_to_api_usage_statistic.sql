alter table "public"."api_usage_statistic" add constraint "public_api_usage_statistic_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."api_usage_statistic" validate constraint "public_api_usage_statistic_user_id_fkey";


