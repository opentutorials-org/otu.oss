alter table "public"."user_info" alter column "updated_at" set not null;

alter table "public"."user_info" alter column "user_id" set default auth.uid();

 
