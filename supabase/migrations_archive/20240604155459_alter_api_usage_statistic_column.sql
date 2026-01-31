
alter table "public"."api_usage_statistic" drop constraint "api_usage_statistics_api_type_id_fkey";

alter table "public"."api_usage_statistic" drop column "api_sum";

alter table "public"."api_usage_statistic" drop column "api_type_id";

alter table "public"."api_usage_statistic" add column "sum" numeric;


