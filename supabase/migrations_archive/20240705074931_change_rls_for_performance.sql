drop policy "select_private_data" on "public"."page";
drop policy "select_public_data" on "public"."page";
drop policy "Enable read access for owner" on "public"."api_usage_raw";
drop policy "Enable read access for owner" on "public"."api_usage_statistic";
drop policy "Enable insert for users based on email" on "public"."beta_tester";
drop policy "Enable update for users based on email" on "public"."beta_tester";
drop policy "Enable read access for all users" on "public"."documents";
drop policy "delete_owned_data_only" on "public"."documents";
drop policy "insert_authenticated_users_only" on "public"."documents";
drop policy "Enable insert for users based on user_id" on "public"."job_queue";
drop policy "Enable read access for all users" on "public"."job_queue";
drop policy "Enable update for users based on email" on "public"."job_queue";
drop policy "delete_owned_data_only" on "public"."page";
drop policy "insert_authenticated_users_only" on "public"."page";
drop policy "update_owned_data_only" on "public"."page";
drop policy "Enable delete for users based on user_id" on "public"."page_deleted";
drop policy "Enable insert for users based on user_id" on "public"."page_deleted";
drop policy "Enable read for users based on user_id" on "public"."page_deleted";
drop policy "Enable insert for users based on user_id" on "public"."user_info";
drop policy "Enable read access for all users" on "public"."user_info";
drop policy "Enable update for owner" on "public"."user_info";

create policy "select_public_or_owner_private_data_on_page"
on "public"."page"
as permissive
for select
to public
using ((((is_public = false) AND (( SELECT auth.uid() AS uid) = user_id)) OR (is_public = true)));

create policy "select_owner_data_on_api_usage_raw"
on "public"."api_usage_raw"
as permissive
for select
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "select_owner_data_on_api_usage_statistic"
on "public"."api_usage_statistic"
as permissive
for select
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert_user_data_by_email_on_beta_tester"
on "public"."beta_tester"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "update_user_data_by_email_on_beta_tester"
on "public"."beta_tester"
as permissive
for update
to public
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select_public_or_owner_private_data_on_documents"
on "public"."documents"
as permissive
for select
to authenticated
using (((is_public = true) OR (( SELECT auth.uid() AS uid) = user_id)));

create policy "delete_owner_data_on_documents"
on "public"."documents"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert_authenticated_user_data_on_documents"
on "public"."documents"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert_user_data_by_user_id_on_job_queue"
on "public"."job_queue"
as permissive
for insert
to public
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select_user_data_by_user_id_on_job_queue"
on "public"."job_queue"
as permissive
for select
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update_user_data_by_email_on_job_queue"
on "public"."job_queue"
as permissive
for update
to public
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete_owner_data_on_page"
on "public"."page"
as permissive
for delete
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert_authenticated_user_data_on_page"
on "public"."page"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "update_owner_data_on_page"
on "public"."page"
as permissive
for update
to public
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete_user_data_by_user_id_on_page_deleted"
on "public"."page_deleted"
as permissive
for delete
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert_user_data_by_user_id_on_page_deleted"
on "public"."page_deleted"
as permissive
for insert
to public
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select_user_data_by_user_id_on_page_deleted"
on "public"."page_deleted"
as permissive
for select
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert_user_data_by_user_id_on_user_info"
on "public"."user_info"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select_user_data_by_user_id_on_user_info"
on "public"."user_info"
as permissive
for select
to public
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update_owner_data_on_user_info"
on "public"."user_info"
as permissive
for update
to public
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));
