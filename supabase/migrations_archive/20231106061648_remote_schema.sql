alter table "public"."superuser" enable row level security;

create policy "Enable read access for all users"
on "public"."superuser"
as permissive
for select
to public
using (true);



