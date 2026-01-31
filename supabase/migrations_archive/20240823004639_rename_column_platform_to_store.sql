create type "public"."store_type" as enum ('app_store', 'play_store', 'stripe');

alter table "public"."usage" drop column "platform";

alter table "public"."usage" add column "store" store_type;

drop type "public"."platform_type";



