set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.attach_into_book_or_library(p_parent_id bigint, p_child_id integer, p_parent_type text, p_position text)
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
    EXECUTE 'INSERT INTO book_page_mapping (book_id, page_id, sort_position) VALUES ($1, $2, $3)' USING p_parent_id, p_child_id, target_position;
  ELSIF p_parent_type = 'library' THEN
    IF p_position = 'prepend' THEN
      SELECT COALESCE(MIN(sort_position), 0) - 1 INTO target_position FROM library_book_mapping WHERE library_id = p_parent_id;
    ELSIF p_position = 'append' THEN
      SELECT COALESCE(MAX(sort_position), 0) + 1 INTO target_position FROM library_book_mapping WHERE library_id = p_parent_id;
    END IF;
    EXECUTE 'INSERT INTO library_book_mapping (library_id, book_id, sort_position) VALUES ($1, $2, $3)' USING p_parent_id, p_child_id, target_position;
  END IF;
END;
$function$
;


