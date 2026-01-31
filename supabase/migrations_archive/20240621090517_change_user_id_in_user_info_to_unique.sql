alter table "public"."user_info" alter column "user_id" set not null;

CREATE UNIQUE INDEX user_info_user_id_key ON public.user_info USING btree (user_id);

alter table "public"."user_info" add constraint "user_info_user_id_key" UNIQUE using index "user_info_user_id_key";


