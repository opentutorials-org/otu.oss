alter table "public"."page" add column "last_embedded_at" timestamp with time zone;

alter table "public"."page" add column "last_viewed_at" timestamp with time zone;

alter table "public"."page" add column "updated_at" timestamp with time zone default now();


