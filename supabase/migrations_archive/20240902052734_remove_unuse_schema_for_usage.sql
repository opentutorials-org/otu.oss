drop trigger if exists "trigger_set_created_month" on "public"."api_usage_raw";

drop policy "Enable insert for users based on user_id" on "public"."api_usage_raw";

drop policy "select_owner_data_on_api_usage_raw" on "public"."api_usage_raw";

drop policy "Enable insert for users based on user_id" on "public"."api_usage_statistic";

drop policy "select_owner_data_on_api_usage_statistic" on "public"."api_usage_statistic";

revoke delete on table "public"."api_usage_raw" from "anon";

revoke insert on table "public"."api_usage_raw" from "anon";

revoke references on table "public"."api_usage_raw" from "anon";

revoke select on table "public"."api_usage_raw" from "anon";

revoke trigger on table "public"."api_usage_raw" from "anon";

revoke truncate on table "public"."api_usage_raw" from "anon";

revoke update on table "public"."api_usage_raw" from "anon";

revoke delete on table "public"."api_usage_raw" from "authenticated";

revoke insert on table "public"."api_usage_raw" from "authenticated";

revoke references on table "public"."api_usage_raw" from "authenticated";

revoke select on table "public"."api_usage_raw" from "authenticated";

revoke trigger on table "public"."api_usage_raw" from "authenticated";

revoke truncate on table "public"."api_usage_raw" from "authenticated";

revoke update on table "public"."api_usage_raw" from "authenticated";

revoke delete on table "public"."api_usage_raw" from "service_role";

revoke insert on table "public"."api_usage_raw" from "service_role";

revoke references on table "public"."api_usage_raw" from "service_role";

revoke select on table "public"."api_usage_raw" from "service_role";

revoke trigger on table "public"."api_usage_raw" from "service_role";

revoke truncate on table "public"."api_usage_raw" from "service_role";

revoke update on table "public"."api_usage_raw" from "service_role";

revoke delete on table "public"."api_usage_statistic" from "anon";

revoke insert on table "public"."api_usage_statistic" from "anon";

revoke references on table "public"."api_usage_statistic" from "anon";

revoke select on table "public"."api_usage_statistic" from "anon";

revoke trigger on table "public"."api_usage_statistic" from "anon";

revoke truncate on table "public"."api_usage_statistic" from "anon";

revoke update on table "public"."api_usage_statistic" from "anon";

revoke delete on table "public"."api_usage_statistic" from "authenticated";

revoke insert on table "public"."api_usage_statistic" from "authenticated";

revoke references on table "public"."api_usage_statistic" from "authenticated";

revoke select on table "public"."api_usage_statistic" from "authenticated";

revoke trigger on table "public"."api_usage_statistic" from "authenticated";

revoke truncate on table "public"."api_usage_statistic" from "authenticated";

revoke update on table "public"."api_usage_statistic" from "authenticated";

revoke delete on table "public"."api_usage_statistic" from "service_role";

revoke insert on table "public"."api_usage_statistic" from "service_role";

revoke references on table "public"."api_usage_statistic" from "service_role";

revoke select on table "public"."api_usage_statistic" from "service_role";

revoke trigger on table "public"."api_usage_statistic" from "service_role";

revoke truncate on table "public"."api_usage_statistic" from "service_role";

revoke update on table "public"."api_usage_statistic" from "service_role";

alter table "public"."api_usage_raw" drop constraint "api_usage_raw_api_type_id_fkey";

alter table "public"."api_usage_raw" drop constraint "api_usage_raw_usage_purpose_fkey";

alter table "public"."api_usage_statistic" drop constraint "public_api_usage_statistic_user_id_fkey";

alter table "public"."api_usage_raw" drop constraint "api_usage_raw_pkey";

alter table "public"."api_usage_statistic" drop constraint "api_usage_statistics_pkey";

drop index if exists "public"."api_usage_raw_pkey";

drop index if exists "public"."api_usage_statistics_pkey";

drop index if exists "public"."idx_api_usage_statistic_user_id_start_date_unique";

drop table "public"."api_usage_raw";

drop table "public"."api_usage_statistic";

alter table "public"."user_info" drop column "available_status";

alter table "public"."user_info" drop column "current_quota";

alter table "public"."user_info" drop column "is_fixed_charge";

alter table "public"."user_info" drop column "pay_type";

alter table "public"."user_info" drop column "price";

alter table "public"."user_info" drop column "start_date";

alter table "public"."user_info" drop column "usage_limit";


