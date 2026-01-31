revoke delete on table "public"."order" from "anon";

revoke insert on table "public"."order" from "anon";

revoke references on table "public"."order" from "anon";

revoke select on table "public"."order" from "anon";

revoke trigger on table "public"."order" from "anon";

revoke truncate on table "public"."order" from "anon";

revoke update on table "public"."order" from "anon";

revoke delete on table "public"."order" from "authenticated";

revoke insert on table "public"."order" from "authenticated";

revoke references on table "public"."order" from "authenticated";

revoke select on table "public"."order" from "authenticated";

revoke trigger on table "public"."order" from "authenticated";

revoke truncate on table "public"."order" from "authenticated";

revoke update on table "public"."order" from "authenticated";

revoke delete on table "public"."order" from "service_role";

revoke insert on table "public"."order" from "service_role";

revoke references on table "public"."order" from "service_role";

revoke select on table "public"."order" from "service_role";

revoke trigger on table "public"."order" from "service_role";

revoke truncate on table "public"."order" from "service_role";

revoke update on table "public"."order" from "service_role";

alter table "public"."order" drop constraint "order_parent_id_fkey";

alter table "public"."order" drop constraint "public_order_subscriptions_id_fkey";

alter table "public"."order" drop constraint "public_order_user_id_fkey";

alter table "public"."order" drop constraint "order_pkey";

drop index if exists "public"."order_pkey";

drop table "public"."order";

create policy "Enable read access for all users"
on "public"."api_usage_purpose"
as permissive
for select
to public
using (true);


create policy "Enable read access for all users"
on "public"."api_vendors"
as permissive
for select
to public
using (true);


create policy "Enable read access for all users"
on "public"."product_payment_type"
as permissive
for select
to public
using (true);


create policy "Enable read access for all users"
on "public"."product_payment_type_price"
as permissive
for select
to public
using (true);



