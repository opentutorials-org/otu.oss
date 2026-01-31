create sequence "public"."documents_id_seq";

drop function if exists "public"."match_topics"(query_embedding vector, match_threshold double precision, match_count integer, exclude_id integer);

create table "public"."documents" (
    "id" bigint not null default nextval('documents_id_seq'::regclass),
    "content" text,
    "metadata" jsonb,
    "embedding" vector(1536)
);


alter table "public"."topics" add column "created_at" timestamp with time zone not null default now();

alter sequence "public"."documents_id_seq" owned by "public"."documents"."id";

CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_count integer DEFAULT NULL::integer, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.match_topics(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id bigint, title text, body text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    topics.id,
    topics.title,
    topics.body,
    1 - (topics.embedding <=> query_embedding) as similarity
  from topics
  -- where 1 - (topics.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$function$
;


