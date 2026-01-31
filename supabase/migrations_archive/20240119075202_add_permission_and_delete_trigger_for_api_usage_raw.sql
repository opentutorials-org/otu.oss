drop trigger if exists "trigger_update_api_usage_statistic" on "public"."api_usage_raw";

drop function if exists "public"."update_api_usage_statistic"();

alter table "public"."api_usage_raw" alter column "user_id" set default auth.uid();

alter table "public"."api_usage_statistic" alter column "user_id" set default auth.uid();

create policy "Enable insert for users based on user_id"
on "public"."api_usage_raw"
as permissive
for insert
to public
with check (true);


create policy "Enable read access for owner"
on "public"."api_usage_raw"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "Enable insert for users based on user_id"
on "public"."api_usage_statistic"
as permissive
for insert
to public
with check (true);

create policy "Enable read access for owner"
on "public"."api_usage_statistic"
as permissive
for select
to public
using ((user_id = auth.uid()));