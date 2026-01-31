create extension if not exists "moddatetime" with schema "extensions";


alter table "public"."subscriptions" drop constraint "public_subscriptions_user_id_fkey";

alter table "public"."subscriptions" alter column "updated_at" set default now();

ALTER TABLE public.subscriptions DROP COLUMN user_id;
ALTER TABLE public.subscriptions ADD COLUMN user_id uuid;
alter table "public"."subscriptions" alter column "user_id" set default auth.uid();

alter table "public"."subscriptions" add constraint "subscriptions_user_id_unique" UNIQUE (user_id);

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

create policy "Enable delete for users based on user_id"
on "public"."subscriptions"
as permissive
for delete
to public
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Enable insert for owner"
on "public"."subscriptions"
as permissive
for insert
to public
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Enable read access for all users"
on "public"."subscriptions"
as permissive
for select
to public
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Enable update for users based on user_id"
on "public"."subscriptions"
as permissive
for update
to public
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));


CREATE TRIGGER handle_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');


