drop policy "Enable read access for self" on "public"."usage";

create policy "Enable read access for self"
on "public"."usage"
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



