create policy "Enable read access for all users"
on "public"."api_type"
as permissive
for select
to public
using (true);


create policy "Enable read access for all users"
on "public"."user_info"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "Enable update for owner"
on "public"."user_info"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



