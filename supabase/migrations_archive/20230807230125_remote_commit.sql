create extension if not exists "vector" with schema "extensions";


create sequence "public"."nods_page_id_seq";

create table "public"."nods_page" (
    "id" bigint not null default nextval('nods_page_id_seq'::regclass),
    "parent_page_id" bigint,
    "path" text not null,
    "checksum" text,
    "meta" jsonb,
    "type" text,
    "source" text
);


alter table "public"."nods_page" enable row level security;

create table "public"."topics" (
    "id" integer generated always as identity not null,
    "title" text not null,
    "body" text not null,
    "embedding" vector(1536),
    "user_id" uuid default auth.uid()
);


alter table "public"."topics" enable row level security;

alter sequence "public"."nods_page_id_seq" owned by "public"."nods_page"."id";

CREATE UNIQUE INDEX nods_page_path_key ON public.nods_page USING btree (path);

CREATE UNIQUE INDEX nods_page_pkey ON public.nods_page USING btree (id);

CREATE UNIQUE INDEX topics_pkey ON public.topics USING btree (id);

alter table "public"."nods_page" add constraint "nods_page_pkey" PRIMARY KEY using index "nods_page_pkey";

alter table "public"."topics" add constraint "topics_pkey" PRIMARY KEY using index "topics_pkey";

alter table "public"."nods_page" add constraint "nods_page_parent_page_id_fkey" FOREIGN KEY (parent_page_id) REFERENCES nods_page(id) not valid;

alter table "public"."nods_page" validate constraint "nods_page_parent_page_id_fkey";

alter table "public"."nods_page" add constraint "nods_page_path_key" UNIQUE using index "nods_page_path_key";

alter table "public"."topics" add constraint "topics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."topics" validate constraint "topics_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_page_parents(page_id bigint)
 RETURNS TABLE(id bigint, parent_page_id bigint, path text, meta jsonb)
 LANGUAGE sql
AS $function$
  with recursive chain as (
    select *
    from nods_page
    where id = page_id

    union all

    select child.*
      from nods_page as child
      join chain on chain.parent_page_id = child.id
  )
  select id, parent_page_id, path, meta
  from chain;
$function$
;

CREATE OR REPLACE FUNCTION public.match_page_sections(embedding vector, match_threshold double precision, match_count integer, min_content_length integer)
 RETURNS TABLE(id bigint, page_id bigint, slug text, heading text, content text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
#variable_conflict use_variable
begin
  return query
  select
    nods_page_section.id,
    nods_page_section.page_id,
    nods_page_section.slug,
    nods_page_section.heading,
    nods_page_section.content,
    (nods_page_section.embedding <#> embedding) * -1 as similarity
  from nods_page_section

  -- We only care about sections that have a useful amount of content
  where length(nods_page_section.content) >= min_content_length

  -- The dot product is negative because of a Postgres limitation, so we negate it
  and (nods_page_section.embedding <#> embedding) * -1 > match_threshold

  -- OpenAI embeddings are normalized to length 1, so
  -- cosine similarity and dot product will produce the same results.
  -- Using dot product which can be computed slightly faster.
  --
  -- For the different syntaxes, see https://github.com/pgvector/pgvector
  order by nods_page_section.embedding <#> embedding

  limit match_count;
end;
$function$
;

create policy "Enable delete for users based on user_id"
on "public"."topics"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Enable insert for authenticated users only"
on "public"."topics"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable read access for all users"
on "public"."topics"
as permissive
for select
to authenticated
using (true);


create policy "Enable update for users based on email"
on "public"."topics"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



