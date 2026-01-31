alter table "public"."nods_page" drop constraint "nods_page_parent_page_id_fkey";

alter table "public"."nods_page" drop constraint "nods_page_path_key";

alter table "public"."nods_page" drop constraint "nods_page_pkey";

drop index if exists "public"."nods_page_path_key";

drop index if exists "public"."nods_page_pkey";

drop table "public"."nods_page";

drop sequence if exists "public"."nods_page_id_seq";


