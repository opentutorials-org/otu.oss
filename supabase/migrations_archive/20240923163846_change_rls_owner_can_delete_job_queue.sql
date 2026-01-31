drop policy "Enable delete for users based on user_id" on "public"."job_queue";

create policy "Enable delete for users based on user_id"
on "public"."job_queue"
as permissive
for delete
to service_role, authenticated
using (((auth.role() = 'service_role'::text) OR (auth.uid() = user_id)));



