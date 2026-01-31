alter table "public"."superuser" drop constraint "superuser_user_id_fkey";

alter table "public"."superuser" add constraint "superuser_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."superuser" validate constraint "superuser_user_id_fkey";


