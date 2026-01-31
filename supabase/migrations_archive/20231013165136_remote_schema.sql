drop function if exists "public"."match_documents"(query_embedding vector, match_threshold double precision, match_count integer);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
select
  documents.id,
  documents.content,
  documents.metadata,
  1 - (documents.embedding <=> query_embedding) as similarity
from documents
where 1 - (documents.embedding <=> query_embedding) > match_threshold
order by similarity desc
limit match_count;
$function$
;


