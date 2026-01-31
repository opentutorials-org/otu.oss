CREATE UNIQUE INDEX subscriptions_user_id_key ON public.subscriptions USING btree (user_id);

alter table "public"."subscriptions" add constraint "subscriptions_user_id_key" UNIQUE using index "subscriptions_user_id_key";


