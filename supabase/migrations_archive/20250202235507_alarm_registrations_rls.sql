alter table "public"."alarm_registrations" enable row level security;

create policy "delete_owner_data_on_alarm_registrations"
on "public"."alarm_registrations"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "insert_authenticated_user_data_on_alarm_registrations"
on "public"."alarm_registrations"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "select_public_or_owner_private_data_on_alarm_registrations"
on "public"."alarm_registrations"
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "update_owner_data_on_alarm_registrations"
on "public"."alarm_registrations"
as permissive
for update
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));


ALTER TABLE public.alarm
ADD COLUMN last_notification_id TEXT NULL;