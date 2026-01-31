drop policy "delete_owner_data_on_page" on "public"."page";

drop policy "Enable delete for users based on user_id" on "public"."subscriptions";

-- alter table "public"."documents" drop constraint "documents_page_id_fkey";

alter table "public"."usage_audit" drop constraint "usage_audit_user_id_fkey";

alter table "public"."user_info" drop constraint "public_user_info_user_id_fkey";

alter table "public"."page" drop constraint "page_user_id_fkey";

alter table "public"."subscriptions" drop constraint "subscriptions_user_id_fkey";

alter table "public"."superuser" drop constraint "superuser_user_id_fkey";

alter table "public"."usage" drop constraint "usage_user_id_fkey";

alter table "public"."user_info" add constraint "user_info_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_info" validate constraint "user_info_user_id_fkey";

alter table "public"."page" add constraint "page_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."page" validate constraint "page_user_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

alter table "public"."superuser" add constraint "superuser_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."superuser" validate constraint "superuser_user_id_fkey";

-- alter table "public"."usage" add constraint "usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

-- alter table "public"."usage" validate constraint "usage_user_id_fkey";

set check_function_bodies = off;

create policy "Enable delete for users based on user_id"
on "public"."superuser"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));

-- create policy "Enable delete for users based on user_id"
-- on "public"."usage_audit"
-- as permissive
-- for delete
-- to authenticated
-- using ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete_owner_data_on_page"
on "public"."page"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));

create policy "Enable delete for users based on user_id"
on "public"."subscriptions"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



