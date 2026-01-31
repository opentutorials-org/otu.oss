drop policy "delete_owned_data_only" on "public"."page";
drop policy "insert_authenticated_users_only" on "public"."page";
drop policy "select_private_data" on "public"."page";
drop policy "update_owned_data_only" on "public"."page";

create policy "delete_owned_data_only"
on "public"."page"
as permissive
for delete
to public
using (( SELECT (auth.uid()) = page.user_id));

create policy "insert_authenticated_users_only"
on "public"."page"
as permissive
for insert
to authenticated
with check (( SELECT (auth.uid()) = page.user_id));

create policy "select_private_data"
on "public"."page"
as permissive
for select
to public
using (((is_public = false) AND ( SELECT (auth.uid()) = page.user_id)));

create policy "update_owned_data_only"
on "public"."page"
as permissive
for update
to public
using (( SELECT (auth.uid()) = page.user_id))
with check (( SELECT (auth.uid()) = page.user_id));
