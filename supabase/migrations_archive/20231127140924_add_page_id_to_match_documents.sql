drop function if exists "public"."match_documents"(query_embedding vector, match_threshold double precision, match_count integer);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision, page_id bigint)
 LANGUAGE sql
 STABLE
AS $function$
SELECT
  documents.id,
  documents.content,
  documents.metadata,
  1 - (documents.embedding <=> query_embedding) AS similarity,
  documents.page_id
FROM documents
WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
ORDER BY similarity DESC
LIMIT match_count;
$function$
;


