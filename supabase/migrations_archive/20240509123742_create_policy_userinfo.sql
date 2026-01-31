create policy "Enable insert for users based on user_id"
on "public"."user_info"
as permissive
for insert
to authenticated
with check ((user_id = auth.uid()));



