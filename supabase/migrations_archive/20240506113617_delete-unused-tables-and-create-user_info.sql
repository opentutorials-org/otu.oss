create type "public"."pay_type" as enum ('subscription', 'free');

revoke delete on table "public"."api_usage" from "anon";

revoke insert on table "public"."api_usage" from "anon";

revoke references on table "public"."api_usage" from "anon";

revoke select on table "public"."api_usage" from "anon";

revoke trigger on table "public"."api_usage" from "anon";

revoke truncate on table "public"."api_usage" from "anon";

revoke update on table "public"."api_usage" from "anon";

revoke delete on table "public"."api_usage" from "authenticated";

revoke insert on table "public"."api_usage" from "authenticated";

revoke references on table "public"."api_usage" from "authenticated";

revoke select on table "public"."api_usage" from "authenticated";

revoke trigger on table "public"."api_usage" from "authenticated";

revoke truncate on table "public"."api_usage" from "authenticated";

revoke update on table "public"."api_usage" from "authenticated";

revoke delete on table "public"."api_usage" from "service_role";

revoke insert on table "public"."api_usage" from "service_role";

revoke references on table "public"."api_usage" from "service_role";

revoke select on table "public"."api_usage" from "service_role";

revoke trigger on table "public"."api_usage" from "service_role";

revoke truncate on table "public"."api_usage" from "service_role";

revoke update on table "public"."api_usage" from "service_role";

revoke delete on table "public"."billing" from "anon";

revoke insert on table "public"."billing" from "anon";

revoke references on table "public"."billing" from "anon";

revoke select on table "public"."billing" from "anon";

revoke trigger on table "public"."billing" from "anon";

revoke truncate on table "public"."billing" from "anon";

revoke update on table "public"."billing" from "anon";

revoke delete on table "public"."billing" from "authenticated";

revoke insert on table "public"."billing" from "authenticated";

revoke references on table "public"."billing" from "authenticated";

revoke select on table "public"."billing" from "authenticated";

revoke trigger on table "public"."billing" from "authenticated";

revoke truncate on table "public"."billing" from "authenticated";

revoke update on table "public"."billing" from "authenticated";

revoke delete on table "public"."billing" from "service_role";

revoke insert on table "public"."billing" from "service_role";

revoke references on table "public"."billing" from "service_role";

revoke select on table "public"."billing" from "service_role";

revoke trigger on table "public"."billing" from "service_role";

revoke truncate on table "public"."billing" from "service_role";

revoke update on table "public"."billing" from "service_role";

revoke delete on table "public"."billing_rates" from "anon";

revoke insert on table "public"."billing_rates" from "anon";

revoke references on table "public"."billing_rates" from "anon";

revoke select on table "public"."billing_rates" from "anon";

revoke trigger on table "public"."billing_rates" from "anon";

revoke truncate on table "public"."billing_rates" from "anon";

revoke update on table "public"."billing_rates" from "anon";

revoke delete on table "public"."billing_rates" from "authenticated";

revoke insert on table "public"."billing_rates" from "authenticated";

revoke references on table "public"."billing_rates" from "authenticated";

revoke select on table "public"."billing_rates" from "authenticated";

revoke trigger on table "public"."billing_rates" from "authenticated";

revoke truncate on table "public"."billing_rates" from "authenticated";

revoke update on table "public"."billing_rates" from "authenticated";

revoke delete on table "public"."billing_rates" from "service_role";

revoke insert on table "public"."billing_rates" from "service_role";

revoke references on table "public"."billing_rates" from "service_role";

revoke select on table "public"."billing_rates" from "service_role";

revoke trigger on table "public"."billing_rates" from "service_role";

revoke truncate on table "public"."billing_rates" from "service_role";

revoke update on table "public"."billing_rates" from "service_role";

revoke delete on table "public"."customers" from "anon";

revoke insert on table "public"."customers" from "anon";

revoke references on table "public"."customers" from "anon";

revoke select on table "public"."customers" from "anon";

revoke trigger on table "public"."customers" from "anon";

revoke truncate on table "public"."customers" from "anon";

revoke update on table "public"."customers" from "anon";

revoke delete on table "public"."customers" from "authenticated";

revoke insert on table "public"."customers" from "authenticated";

revoke references on table "public"."customers" from "authenticated";

revoke select on table "public"."customers" from "authenticated";

revoke trigger on table "public"."customers" from "authenticated";

revoke truncate on table "public"."customers" from "authenticated";

revoke update on table "public"."customers" from "authenticated";

revoke delete on table "public"."customers" from "service_role";

revoke insert on table "public"."customers" from "service_role";

revoke references on table "public"."customers" from "service_role";

revoke select on table "public"."customers" from "service_role";

revoke trigger on table "public"."customers" from "service_role";

revoke truncate on table "public"."customers" from "service_role";

revoke update on table "public"."customers" from "service_role";

revoke delete on table "public"."order_items" from "anon";

revoke insert on table "public"."order_items" from "anon";

revoke references on table "public"."order_items" from "anon";

revoke select on table "public"."order_items" from "anon";

revoke trigger on table "public"."order_items" from "anon";

revoke truncate on table "public"."order_items" from "anon";

revoke update on table "public"."order_items" from "anon";

revoke delete on table "public"."order_items" from "authenticated";

revoke insert on table "public"."order_items" from "authenticated";

revoke references on table "public"."order_items" from "authenticated";

revoke select on table "public"."order_items" from "authenticated";

revoke trigger on table "public"."order_items" from "authenticated";

revoke truncate on table "public"."order_items" from "authenticated";

revoke update on table "public"."order_items" from "authenticated";

revoke delete on table "public"."order_items" from "service_role";

revoke insert on table "public"."order_items" from "service_role";

revoke references on table "public"."order_items" from "service_role";

revoke select on table "public"."order_items" from "service_role";

revoke trigger on table "public"."order_items" from "service_role";

revoke truncate on table "public"."order_items" from "service_role";

revoke update on table "public"."order_items" from "service_role";

revoke delete on table "public"."orders" from "anon";

revoke insert on table "public"."orders" from "anon";

revoke references on table "public"."orders" from "anon";

revoke select on table "public"."orders" from "anon";

revoke trigger on table "public"."orders" from "anon";

revoke truncate on table "public"."orders" from "anon";

revoke update on table "public"."orders" from "anon";

revoke delete on table "public"."orders" from "authenticated";

revoke insert on table "public"."orders" from "authenticated";

revoke references on table "public"."orders" from "authenticated";

revoke select on table "public"."orders" from "authenticated";

revoke trigger on table "public"."orders" from "authenticated";

revoke truncate on table "public"."orders" from "authenticated";

revoke update on table "public"."orders" from "authenticated";

revoke delete on table "public"."orders" from "service_role";

revoke insert on table "public"."orders" from "service_role";

revoke references on table "public"."orders" from "service_role";

revoke select on table "public"."orders" from "service_role";

revoke trigger on table "public"."orders" from "service_role";

revoke truncate on table "public"."orders" from "service_role";

revoke update on table "public"."orders" from "service_role";

revoke delete on table "public"."payment_information" from "anon";

revoke insert on table "public"."payment_information" from "anon";

revoke references on table "public"."payment_information" from "anon";

revoke select on table "public"."payment_information" from "anon";

revoke trigger on table "public"."payment_information" from "anon";

revoke truncate on table "public"."payment_information" from "anon";

revoke update on table "public"."payment_information" from "anon";

revoke delete on table "public"."payment_information" from "authenticated";

revoke insert on table "public"."payment_information" from "authenticated";

revoke references on table "public"."payment_information" from "authenticated";

revoke select on table "public"."payment_information" from "authenticated";

revoke trigger on table "public"."payment_information" from "authenticated";

revoke truncate on table "public"."payment_information" from "authenticated";

revoke update on table "public"."payment_information" from "authenticated";

revoke delete on table "public"."payment_information" from "service_role";

revoke insert on table "public"."payment_information" from "service_role";

revoke references on table "public"."payment_information" from "service_role";

revoke select on table "public"."payment_information" from "service_role";

revoke trigger on table "public"."payment_information" from "service_role";

revoke truncate on table "public"."payment_information" from "service_role";

revoke update on table "public"."payment_information" from "service_role";

revoke delete on table "public"."payment_records" from "anon";

revoke insert on table "public"."payment_records" from "anon";

revoke references on table "public"."payment_records" from "anon";

revoke select on table "public"."payment_records" from "anon";

revoke trigger on table "public"."payment_records" from "anon";

revoke truncate on table "public"."payment_records" from "anon";

revoke update on table "public"."payment_records" from "anon";

revoke delete on table "public"."payment_records" from "authenticated";

revoke insert on table "public"."payment_records" from "authenticated";

revoke references on table "public"."payment_records" from "authenticated";

revoke select on table "public"."payment_records" from "authenticated";

revoke trigger on table "public"."payment_records" from "authenticated";

revoke truncate on table "public"."payment_records" from "authenticated";

revoke update on table "public"."payment_records" from "authenticated";

revoke delete on table "public"."payment_records" from "service_role";

revoke insert on table "public"."payment_records" from "service_role";

revoke references on table "public"."payment_records" from "service_role";

revoke select on table "public"."payment_records" from "service_role";

revoke trigger on table "public"."payment_records" from "service_role";

revoke truncate on table "public"."payment_records" from "service_role";

revoke update on table "public"."payment_records" from "service_role";

revoke delete on table "public"."products" from "anon";

revoke insert on table "public"."products" from "anon";

revoke references on table "public"."products" from "anon";

revoke select on table "public"."products" from "anon";

revoke trigger on table "public"."products" from "anon";

revoke truncate on table "public"."products" from "anon";

revoke update on table "public"."products" from "anon";

revoke delete on table "public"."products" from "authenticated";

revoke insert on table "public"."products" from "authenticated";

revoke references on table "public"."products" from "authenticated";

revoke select on table "public"."products" from "authenticated";

revoke trigger on table "public"."products" from "authenticated";

revoke truncate on table "public"."products" from "authenticated";

revoke update on table "public"."products" from "authenticated";

revoke delete on table "public"."products" from "service_role";

revoke insert on table "public"."products" from "service_role";

revoke references on table "public"."products" from "service_role";

revoke select on table "public"."products" from "service_role";

revoke trigger on table "public"."products" from "service_role";

revoke truncate on table "public"."products" from "service_role";

revoke update on table "public"."products" from "service_role";

revoke delete on table "public"."profile" from "anon";

revoke insert on table "public"."profile" from "anon";

revoke references on table "public"."profile" from "anon";

revoke select on table "public"."profile" from "anon";

revoke trigger on table "public"."profile" from "anon";

revoke truncate on table "public"."profile" from "anon";

revoke update on table "public"."profile" from "anon";

revoke delete on table "public"."profile" from "authenticated";

revoke insert on table "public"."profile" from "authenticated";

revoke references on table "public"."profile" from "authenticated";

revoke select on table "public"."profile" from "authenticated";

revoke trigger on table "public"."profile" from "authenticated";

revoke truncate on table "public"."profile" from "authenticated";

revoke update on table "public"."profile" from "authenticated";

revoke delete on table "public"."profile" from "service_role";

revoke insert on table "public"."profile" from "service_role";

revoke references on table "public"."profile" from "service_role";

revoke select on table "public"."profile" from "service_role";

revoke trigger on table "public"."profile" from "service_role";

revoke truncate on table "public"."profile" from "service_role";

revoke update on table "public"."profile" from "service_role";

revoke delete on table "public"."subscriptions" from "anon";

revoke insert on table "public"."subscriptions" from "anon";

revoke references on table "public"."subscriptions" from "anon";

revoke select on table "public"."subscriptions" from "anon";

revoke trigger on table "public"."subscriptions" from "anon";

revoke truncate on table "public"."subscriptions" from "anon";

revoke update on table "public"."subscriptions" from "anon";

revoke delete on table "public"."subscriptions" from "authenticated";

revoke insert on table "public"."subscriptions" from "authenticated";

revoke references on table "public"."subscriptions" from "authenticated";

revoke select on table "public"."subscriptions" from "authenticated";

revoke trigger on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."subscriptions" from "authenticated";

revoke update on table "public"."subscriptions" from "authenticated";

revoke delete on table "public"."subscriptions" from "service_role";

revoke insert on table "public"."subscriptions" from "service_role";

revoke references on table "public"."subscriptions" from "service_role";

revoke select on table "public"."subscriptions" from "service_role";

revoke trigger on table "public"."subscriptions" from "service_role";

revoke truncate on table "public"."subscriptions" from "service_role";

revoke update on table "public"."subscriptions" from "service_role";

alter table "public"."api_usage" drop constraint "apiusage_customerid_fkey";

alter table "public"."billing" drop constraint "billing_customerid_fkey";

alter table "public"."order_items" drop constraint "orderitems_orderid_fkey";

alter table "public"."order_items" drop constraint "orderitems_productid_fkey";

alter table "public"."orders" drop constraint "orders_customerid_fkey";

alter table "public"."payment_information" drop constraint "payment_information_customer_id_fkey";

alter table "public"."payment_records" drop constraint "payment_records_order_id_fkey";

alter table "public"."profile" drop constraint "profile_user_id_fkey";

alter table "public"."subscriptions" drop constraint "subscriptions_order_item_id_fkey";

alter table "public"."subscriptions" drop constraint "subscriptions_payment_info_id_fkey";

alter table "public"."api_usage" drop constraint "api_usage_pkey";

alter table "public"."billing" drop constraint "billing_pkey";

alter table "public"."billing_rates" drop constraint "billing_rates_pkey";

alter table "public"."customers" drop constraint "customers_pkey";

alter table "public"."order_items" drop constraint "order_items_pkey";

alter table "public"."orders" drop constraint "orders_pkey";

alter table "public"."payment_information" drop constraint "payment_information_pkey";

alter table "public"."payment_records" drop constraint "payment_records_pkey";

alter table "public"."products" drop constraint "products_pkey";

alter table "public"."profile" drop constraint "profiles_pkey";

alter table "public"."subscriptions" drop constraint "subscriptions_pkey";

drop index if exists "public"."api_usage_pkey";

drop index if exists "public"."billing_pkey";

drop index if exists "public"."billing_rates_pkey";

drop index if exists "public"."customers_pkey";

drop index if exists "public"."order_items_pkey";

drop index if exists "public"."orders_pkey";

drop index if exists "public"."payment_information_pkey";

drop index if exists "public"."payment_records_pkey";

drop index if exists "public"."products_pkey";

drop index if exists "public"."profiles_pkey";

drop index if exists "public"."subscriptions_pkey";

drop table "public"."api_usage";

drop table "public"."billing";

drop table "public"."billing_rates";

drop table "public"."customers";

drop table "public"."order_items";

drop table "public"."orders";

drop table "public"."payment_information";

drop table "public"."payment_records";

drop table "public"."products";

drop table "public"."profile";

drop table "public"."subscriptions";

create table "public"."user_info" (
    "id" bigint generated by default as identity not null,
    "pay_type" pay_type default 'free'::pay_type,
    "is_fixed_charge" boolean default true,
    "is_avaliable" boolean default true,
    "user_id" uuid,
    "updated_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."user_info" enable row level security;

CREATE UNIQUE INDEX user_info_pkey ON public.user_info USING btree (id);

alter table "public"."user_info" add constraint "user_info_pkey" PRIMARY KEY using index "user_info_pkey";

alter table "public"."user_info" add constraint "public_user_info_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."user_info" validate constraint "public_user_info_user_id_fkey";

grant delete on table "public"."user_info" to "anon";

grant insert on table "public"."user_info" to "anon";

grant references on table "public"."user_info" to "anon";

grant select on table "public"."user_info" to "anon";

grant trigger on table "public"."user_info" to "anon";

grant truncate on table "public"."user_info" to "anon";

grant update on table "public"."user_info" to "anon";

grant delete on table "public"."user_info" to "authenticated";

grant insert on table "public"."user_info" to "authenticated";

grant references on table "public"."user_info" to "authenticated";

grant select on table "public"."user_info" to "authenticated";

grant trigger on table "public"."user_info" to "authenticated";

grant truncate on table "public"."user_info" to "authenticated";

grant update on table "public"."user_info" to "authenticated";

grant delete on table "public"."user_info" to "service_role";

grant insert on table "public"."user_info" to "service_role";

grant references on table "public"."user_info" to "service_role";

grant select on table "public"."user_info" to "service_role";

grant trigger on table "public"."user_info" to "service_role";

grant truncate on table "public"."user_info" to "service_role";

grant update on table "public"."user_info" to "service_role";


