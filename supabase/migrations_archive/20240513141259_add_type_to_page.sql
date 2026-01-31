create type "public"."page_type" as enum ('text', 'draw');

alter table "public"."page" add column "type" page_type not null default 'text'::page_type;


