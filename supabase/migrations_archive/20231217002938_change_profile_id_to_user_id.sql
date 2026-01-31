alter table "public"."profile" drop constraint "profile_id_fkey";

alter table "public"."profile" drop constraint "profiles_pkey";

drop index if exists "public"."profiles_pkey";

alter table "public"."profile" drop column "id";

alter table "public"."profile" add column "user_id" uuid not null;

CREATE UNIQUE INDEX profiles_pkey ON public.profile USING btree (user_id);

alter table "public"."profile" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."profile" add constraint "profile_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profile" validate constraint "profile_user_id_fkey";


