create extension if not exists "pgroonga" with schema "extensions";


CREATE INDEX ix_page_title_body ON public.page USING pgroonga ((((title || ' '::text) || body)));

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.search_page(keyword text, additional_condition text DEFAULT ''::text, order_by text DEFAULT ''::text, limit_result integer DEFAULT NULL::integer, offset_result integer DEFAULT 0)
 RETURNS TABLE(id integer, title text, body text, user_id uuid, is_public boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
    query TEXT;
BEGIN
    query := 'SELECT id, title, body, user_id, is_public, created_at FROM page WHERE (title || '' '' || body) &@~ ' || quote_literal(keyword);

    IF additional_condition <> '' THEN
        query := query || ' AND ' || additional_condition;
    END IF;

    IF order_by <> '' THEN
        query := query || ' ORDER BY ' || order_by;
    END IF;

    -- LIMIT과 OFFSET 적용
    IF limit_result IS NOT NULL THEN
        query := query || ' LIMIT ' || limit_result;
    END IF;
    IF offset_result IS NOT NULL THEN
        query := query || ' OFFSET ' || offset_result;
    END IF;

    RETURN QUERY EXECUTE query;
END;
$function$
;


