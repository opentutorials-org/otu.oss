alter table "public"."book_page_mapping" drop column "seperator";

alter table "public"."book_page_mapping" add column "separator" text;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.change_sort_position(p_parent_type text, p_parent_id integer, p_child_source_id integer, p_child_target_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF p_parent_type = 'library' THEN
    DECLARE
      target_sort_position integer;
    BEGIN
      SELECT sort_position INTO target_sort_position
      FROM library_book_mapping
      WHERE library_id = p_parent_id AND book_id = p_child_target_id;

      UPDATE library_book_mapping
      SET sort_position = sort_position + 1
      WHERE library_id = p_parent_id AND sort_position >= target_sort_position;

      UPDATE library_book_mapping
      SET sort_position = target_sort_position
      WHERE library_id = p_parent_id AND book_id = p_child_source_id;
    END;
  ELSIF p_parent_type = 'book' THEN
    DECLARE
      target_sort_position integer;
    BEGIN
      SELECT sort_position INTO target_sort_position
      FROM book_page_mapping
      WHERE book_id = p_parent_id AND page_id = p_child_target_id;

      UPDATE book_page_mapping
      SET sort_position = sort_position + 1
      WHERE book_id = p_parent_id AND sort_position >= target_sort_position;

      UPDATE book_page_mapping
      SET sort_position = target_sort_position
      WHERE book_id = p_parent_id AND page_id = p_child_source_id;
    END;
  END IF;
END;
$function$
;


