set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE TRIGGER update_page_modified_time BEFORE UPDATE ON public.page FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


