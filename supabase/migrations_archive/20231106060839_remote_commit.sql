create table "public"."superuser" (
    "user_id" uuid not null
);


CREATE UNIQUE INDEX superuser_pkey ON public.superuser USING btree (user_id);

alter table "public"."superuser" add constraint "superuser_pkey" PRIMARY KEY using index "superuser_pkey";

alter table "public"."superuser" add constraint "superuser_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profile(id) ON DELETE CASCADE not valid;

alter table "public"."superuser" validate constraint "superuser_user_id_fkey";


