ALTER FUNCTION public.attach_into_book_or_library(p_parent_id bigint, p_child_id integer, p_parent_type text, p_position text)
SET search_path = public;

ALTER FUNCTION public.change_sort_position(p_parent_type text, p_parent_id integer, p_child_source_id integer, p_child_target_id integer)
SET search_path = public;

ALTER FUNCTION public.get_page_parents(page_id bigint)
SET search_path = public;

ALTER FUNCTION public.log_usage_changes()
SET search_path = public;

ALTER FUNCTION public.match_documents(query_embedding extensions.vector, match_threshold double precision, match_count integer, input_page_id text)
SET search_path = public, extensions;

ALTER FUNCTION public.match_page_sections(embedding extensions.vector, match_threshold double precision, match_count integer, min_content_length integer)
SET search_path = public, extensions;

ALTER FUNCTION public.match_pages(query_embedding extensions.vector, match_threshold double precision, match_count integer, exclude_id integer)
SET search_path = public, extensions;

ALTER FUNCTION public.match_topics(query_embedding extensions.vector, match_threshold double precision, match_count integer)
SET search_path = public, extensions;

ALTER FUNCTION public.page_delete_trigger_func()
SET search_path = public;

ALTER FUNCTION public.search_page(keyword text, additional_condition text, order_by text, limit_result integer, offset_result integer)
SET search_path = public;

ALTER FUNCTION public.set_created_month()
SET search_path = public;

ALTER FUNCTION public.update_book_child_count()
SET search_path = public;

ALTER FUNCTION public.update_book_parent_count()
SET search_path = public;

ALTER FUNCTION public.update_consent_times()
SET search_path = public;

ALTER FUNCTION public.update_last_viewed_at(page_id integer)
SET search_path = public;

ALTER FUNCTION public.update_library_child_count()
SET search_path = public;

ALTER FUNCTION public.update_page_parent_count()
SET search_path = public;

ALTER FUNCTION public.update_registered_at()
SET search_path = public;

ALTER FUNCTION public.update_updated_at_column()
SET search_path = public;