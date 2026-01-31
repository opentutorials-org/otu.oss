set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_last_viewed_at(page_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE public.page
    SET last_viewed_at = now()
    WHERE id = page_id;
END;
$function$
;


