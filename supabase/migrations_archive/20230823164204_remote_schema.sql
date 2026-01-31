alter table "public"."book" add column "parent_count" integer default 0;

alter table "public"."library" add column "parent_count" integer default 0;

alter table "public"."page" add column "child_count" integer default 0;

alter table "public"."page" add column "parent_count" integer default 0;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_book_parent_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."book" SET parent_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE book_id = NEW.book_id) WHERE id = NEW.book_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."book" SET parent_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE book_id = OLD.book_id) WHERE id = OLD.book_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_page_parent_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."page" SET parent_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE page_id = NEW.page_id) WHERE id = NEW.page_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."page" SET parent_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE page_id = OLD.page_id) WHERE id = OLD.page_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER trigger_update_page_parent_count AFTER INSERT OR DELETE OR UPDATE ON public.book_page_mapping FOR EACH ROW EXECUTE FUNCTION update_page_parent_count();

CREATE TRIGGER trigger_update_book_parent_count AFTER INSERT OR DELETE OR UPDATE ON public.library_book_mapping FOR EACH ROW EXECUTE FUNCTION update_book_parent_count();


