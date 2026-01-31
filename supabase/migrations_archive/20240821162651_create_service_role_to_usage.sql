alter table "public"."usage" enable row level security;

create policy "Allow service role to insert"
on "public"."usage"
as permissive
for insert
to service_role
with check (true);


create policy "Enable read access for self"
on "public"."usage"
as permissive
for select
to anon
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Enable update for service role"
on "public"."usage"
as permissive
for update
to service_role
using (true);



