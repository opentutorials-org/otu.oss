drop trigger if exists "trigger_update_book_child_count" on "public"."book_page_mapping";

drop trigger if exists "trigger_update_page_parent_count" on "public"."book_page_mapping";

drop trigger if exists "trigger_update_book_parent_count" on "public"."library_book_mapping";

drop trigger if exists "trigger_update_library_child_count" on "public"."library_book_mapping";

drop policy "delete_owned_data_only" on "public"."book";

drop policy "insert_authenticated_users_only" on "public"."book";

drop policy "select_private_data" on "public"."book";

drop policy "select_public_data" on "public"."book";

drop policy "update_owned_data_only" on "public"."book";

drop policy "delete_owned_data_only" on "public"."book_page_mapping";

drop policy "insert_authenticated_users_only" on "public"."book_page_mapping";

drop policy "select" on "public"."book_page_mapping";

drop policy "update_owned_data_only" on "public"."book_page_mapping";

drop policy "delete_owned_data_only" on "public"."library";

drop policy "insert_authenticated_users_only" on "public"."library";

drop policy "select_private_data" on "public"."library";

drop policy "select_public_data" on "public"."library";

drop policy "update_owned_data_only" on "public"."library";

drop policy "delete_owned_data_only" on "public"."library_book_mapping";

drop policy "insert_authenticated_users_only" on "public"."library_book_mapping";

drop policy "select_public_data" on "public"."library_book_mapping";

drop policy "update_owned_data_only" on "public"."library_book_mapping";

revoke delete on table "public"."book" from "anon";

revoke insert on table "public"."book" from "anon";

revoke references on table "public"."book" from "anon";

revoke select on table "public"."book" from "anon";

revoke trigger on table "public"."book" from "anon";

revoke truncate on table "public"."book" from "anon";

revoke update on table "public"."book" from "anon";

revoke delete on table "public"."book" from "authenticated";

revoke insert on table "public"."book" from "authenticated";

revoke references on table "public"."book" from "authenticated";

revoke select on table "public"."book" from "authenticated";

revoke trigger on table "public"."book" from "authenticated";

revoke truncate on table "public"."book" from "authenticated";

revoke update on table "public"."book" from "authenticated";

revoke delete on table "public"."book" from "service_role";

revoke insert on table "public"."book" from "service_role";

revoke references on table "public"."book" from "service_role";

revoke select on table "public"."book" from "service_role";

revoke trigger on table "public"."book" from "service_role";

revoke truncate on table "public"."book" from "service_role";

revoke update on table "public"."book" from "service_role";

revoke delete on table "public"."book_page_mapping" from "anon";

revoke insert on table "public"."book_page_mapping" from "anon";

revoke references on table "public"."book_page_mapping" from "anon";

revoke select on table "public"."book_page_mapping" from "anon";

revoke trigger on table "public"."book_page_mapping" from "anon";

revoke truncate on table "public"."book_page_mapping" from "anon";

revoke update on table "public"."book_page_mapping" from "anon";

revoke delete on table "public"."book_page_mapping" from "authenticated";

revoke insert on table "public"."book_page_mapping" from "authenticated";

revoke references on table "public"."book_page_mapping" from "authenticated";

revoke select on table "public"."book_page_mapping" from "authenticated";

revoke trigger on table "public"."book_page_mapping" from "authenticated";

revoke truncate on table "public"."book_page_mapping" from "authenticated";

revoke update on table "public"."book_page_mapping" from "authenticated";

revoke delete on table "public"."book_page_mapping" from "service_role";

revoke insert on table "public"."book_page_mapping" from "service_role";

revoke references on table "public"."book_page_mapping" from "service_role";

revoke select on table "public"."book_page_mapping" from "service_role";

revoke trigger on table "public"."book_page_mapping" from "service_role";

revoke truncate on table "public"."book_page_mapping" from "service_role";

revoke update on table "public"."book_page_mapping" from "service_role";

revoke delete on table "public"."library" from "anon";

revoke insert on table "public"."library" from "anon";

revoke references on table "public"."library" from "anon";

revoke select on table "public"."library" from "anon";

revoke trigger on table "public"."library" from "anon";

revoke truncate on table "public"."library" from "anon";

revoke update on table "public"."library" from "anon";

revoke delete on table "public"."library" from "authenticated";

revoke insert on table "public"."library" from "authenticated";

revoke references on table "public"."library" from "authenticated";

revoke select on table "public"."library" from "authenticated";

revoke trigger on table "public"."library" from "authenticated";

revoke truncate on table "public"."library" from "authenticated";

revoke update on table "public"."library" from "authenticated";

revoke delete on table "public"."library" from "service_role";

revoke insert on table "public"."library" from "service_role";

revoke references on table "public"."library" from "service_role";

revoke select on table "public"."library" from "service_role";

revoke trigger on table "public"."library" from "service_role";

revoke truncate on table "public"."library" from "service_role";

revoke update on table "public"."library" from "service_role";

revoke delete on table "public"."library_book_mapping" from "anon";

revoke insert on table "public"."library_book_mapping" from "anon";

revoke references on table "public"."library_book_mapping" from "anon";

revoke select on table "public"."library_book_mapping" from "anon";

revoke trigger on table "public"."library_book_mapping" from "anon";

revoke truncate on table "public"."library_book_mapping" from "anon";

revoke update on table "public"."library_book_mapping" from "anon";

revoke delete on table "public"."library_book_mapping" from "authenticated";

revoke insert on table "public"."library_book_mapping" from "authenticated";

revoke references on table "public"."library_book_mapping" from "authenticated";

revoke select on table "public"."library_book_mapping" from "authenticated";

revoke trigger on table "public"."library_book_mapping" from "authenticated";

revoke truncate on table "public"."library_book_mapping" from "authenticated";

revoke update on table "public"."library_book_mapping" from "authenticated";

revoke delete on table "public"."library_book_mapping" from "service_role";

revoke insert on table "public"."library_book_mapping" from "service_role";

revoke references on table "public"."library_book_mapping" from "service_role";

revoke select on table "public"."library_book_mapping" from "service_role";

revoke trigger on table "public"."library_book_mapping" from "service_role";

revoke truncate on table "public"."library_book_mapping" from "service_role";

revoke update on table "public"."library_book_mapping" from "service_role";

alter table "public"."book" drop constraint "book_user_id_fkey";

alter table "public"."book_page_mapping" drop constraint "book_page_mapping_book_id_fkey";

alter table "public"."book_page_mapping" drop constraint "book_page_mapping_page_id_fkey";

alter table "public"."book_page_mapping" drop constraint "book_page_mapping_user_id_fkey";

alter table "public"."documents" drop constraint "documents_page_id_fkey";

alter table "public"."library" drop constraint "library_user_id_fkey";

alter table "public"."library_book_mapping" drop constraint "library_book_mapping_book_id_fkey";

alter table "public"."library_book_mapping" drop constraint "library_book_mapping_library_id_fkey";

alter table "public"."library_book_mapping" drop constraint "library_book_mapping_user_id_fkey";

alter table "public"."book" drop constraint "book_pkey";

alter table "public"."book_page_mapping" drop constraint "book_page_mapping_pk";

alter table "public"."library" drop constraint "library_pkey";

alter table "public"."library_book_mapping" drop constraint "library_book_mapping_pk";

drop index if exists "public"."book_page_mapping_pk";

drop index if exists "public"."book_pkey";

drop index if exists "public"."library_book_mapping_pk";

drop index if exists "public"."library_pkey";

drop table "public"."book";

drop table "public"."book_page_mapping";

drop table "public"."library";

drop table "public"."library_book_mapping";

create table "public"."page_deleted" (
    "id" text not null,
    "created_at" timestamp with time zone not null default now(),
    "user_id" uuid not null default auth.uid()
);


alter table "public"."page_deleted" enable row level security;

alter table "public"."documents" alter column "page_id" set data type text using "page_id"::text;

alter table "public"."page" alter column "id" drop identity;

alter table "public"."page" alter column "id" set data type text using "id"::text;

CREATE UNIQUE INDEX page_deleted_pkey ON public.page_deleted USING btree (id);

alter table "public"."page_deleted" add constraint "page_deleted_pkey" PRIMARY KEY using index "page_deleted_pkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.page_delete_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.page_deleted(id, user_id)
  VALUES (OLD.id, OLD.user_id);
  RETURN OLD;
END;
$function$
;

grant delete on table "public"."page_deleted" to "anon";

grant insert on table "public"."page_deleted" to "anon";

grant references on table "public"."page_deleted" to "anon";

grant select on table "public"."page_deleted" to "anon";

grant trigger on table "public"."page_deleted" to "anon";

grant truncate on table "public"."page_deleted" to "anon";

grant update on table "public"."page_deleted" to "anon";

grant delete on table "public"."page_deleted" to "authenticated";

grant insert on table "public"."page_deleted" to "authenticated";

grant references on table "public"."page_deleted" to "authenticated";

grant select on table "public"."page_deleted" to "authenticated";

grant trigger on table "public"."page_deleted" to "authenticated";

grant truncate on table "public"."page_deleted" to "authenticated";

grant update on table "public"."page_deleted" to "authenticated";

grant delete on table "public"."page_deleted" to "service_role";

grant insert on table "public"."page_deleted" to "service_role";

grant references on table "public"."page_deleted" to "service_role";

grant select on table "public"."page_deleted" to "service_role";

grant trigger on table "public"."page_deleted" to "service_role";

grant truncate on table "public"."page_deleted" to "service_role";

grant update on table "public"."page_deleted" to "service_role";

create policy "Enable insert for users based on user_id"
on "public"."page_deleted"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Enable read for users based on user_id"
on "public"."page_deleted"
as permissive
for select
to public
using ((auth.uid() = user_id));


CREATE TRIGGER page_before_delete_trigger BEFORE DELETE ON public.page FOR EACH ROW EXECUTE FUNCTION page_delete_trigger_func();


