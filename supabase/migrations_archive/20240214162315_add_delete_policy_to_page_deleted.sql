create policy "Enable delete for users based on user_id"
on "public"."page_deleted"
as permissive
for delete
to public
using ((auth.uid() = user_id));



