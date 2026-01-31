alter table "public"."book" add column "child_count" integer default 0;

alter table "public"."library" add column "child_count" integer default 0;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_book_child_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."book" SET child_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE book_id = NEW.book_id) WHERE id = NEW.book_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."book" SET child_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE book_id = OLD.book_id) WHERE id = OLD.book_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_library_child_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."library" SET child_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE library_id = NEW.library_id) WHERE id = NEW.library_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."library" SET child_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE library_id = OLD.library_id) WHERE id = OLD.library_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.attach_into_book_or_library(p_parent_id bigint, p_child_id integer, p_is_public boolean, p_parent_type text, p_position text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_position integer;
BEGIN
  IF p_parent_type = 'book' THEN
    IF p_position = 'prepend' THEN
      SELECT COALESCE(MIN(sort_position), 0) - 1 INTO target_position FROM book_page_mapping WHERE book_id = p_parent_id;
    ELSIF p_position = 'append' THEN
      SELECT COALESCE(MAX(sort_position), 0) + 1 INTO target_position FROM book_page_mapping WHERE book_id = p_parent_id;
    END IF;
    EXECUTE 'INSERT INTO book_page_mapping (book_id, page_id, sort_position, is_public) VALUES ($1, $2, $3, $4)' USING p_parent_id, p_child_id, target_position, p_is_public;
  ELSIF p_parent_type = 'library' THEN
    IF p_position = 'prepend' THEN
      SELECT COALESCE(MIN(sort_position), 0) - 1 INTO target_position FROM library_book_mapping WHERE library_id = p_parent_id;
    ELSIF p_position = 'append' THEN
      SELECT COALESCE(MAX(sort_position), 0) + 1 INTO target_position FROM library_book_mapping WHERE library_id = p_parent_id;
    END IF;
    EXECUTE 'INSERT INTO library_book_mapping (library_id, book_id, sort_position, is_public) VALUES ($1, $2, $3, $4)' USING p_parent_id, p_child_id, target_position, p_is_public;
  END IF;
END;
$function$
;

CREATE TRIGGER trigger_update_book_child_count AFTER INSERT OR DELETE OR UPDATE ON public.book_page_mapping FOR EACH ROW EXECUTE FUNCTION update_book_child_count();

CREATE TRIGGER trigger_update_library_child_count AFTER INSERT OR DELETE OR UPDATE ON public.library_book_mapping FOR EACH ROW EXECUTE FUNCTION update_library_child_count();


