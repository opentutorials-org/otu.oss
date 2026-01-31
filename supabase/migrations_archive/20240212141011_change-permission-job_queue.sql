create policy "Enable delete for users based on user_id"
on "public"."job_queue"
as permissive
for delete
to service_role
using (true);



