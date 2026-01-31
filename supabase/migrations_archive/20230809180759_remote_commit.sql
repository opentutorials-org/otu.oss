set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_topics(query_embedding vector, match_threshold double precision, match_count integer, exclude_id integer)
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


