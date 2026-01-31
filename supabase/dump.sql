

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgroonga" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgtap" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."job_status" AS ENUM (
    'PENDING',
    'RUNNING',
    'FAIL'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."page_type" AS ENUM (
    'text',
    'draw'
);


ALTER TYPE "public"."page_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_for_sleep_time"("p_time" timestamp with time zone, "p_timezone" "text") RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_local_hour INT;
    v_local_time TIMESTAMP;
    v_adjusted_time TIMESTAMP WITH TIME ZONE;
BEGIN
    RAISE DEBUG 'adjust_for_sleep_time: p_time=%, p_timezone=%', p_time, p_timezone;
    -- 사용자 시간대로 변환하여 시간 확인
    v_local_time := p_time AT TIME ZONE p_timezone;
    v_local_hour := EXTRACT(HOUR FROM v_local_time);
    
    -- 수면시간(22:00~07:00) 확인
    IF v_local_hour >= 22 OR v_local_hour < 7 THEN
        -- 다음날 7시로 조정
        IF v_local_hour >= 22 THEN
            v_adjusted_time := (v_local_time::DATE + INTERVAL '1 day' + INTERVAL '7 hours') AT TIME ZONE p_timezone;
        ELSE
            v_adjusted_time := (v_local_time::DATE + INTERVAL '7 hours') AT TIME ZONE p_timezone;
        END IF;
        RAISE DEBUG 'adjust_for_sleep_time: adjusted_time=%', v_adjusted_time;
        RETURN v_adjusted_time;
    END IF;
    
    RAISE DEBUG 'adjust_for_sleep_time: no adjustment, returning %', p_time;
    RETURN p_time;
END;
$$;


ALTER FUNCTION "public"."adjust_for_sleep_time"("p_time" timestamp with time zone, "p_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."alarm_delete_trigger_func"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.alarm_deleted(id, user_id)
  VALUES (OLD.id, OLD.user_id);
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."alarm_delete_trigger_func"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."attach_into_book_or_library"("p_parent_id" bigint, "p_child_id" integer, "p_parent_type" "text", "p_position" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."attach_into_book_or_library"("p_parent_id" bigint, "p_child_id" integer, "p_parent_type" "text", "p_position" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_progressive_interval"("p_base_time" timestamp with time zone, "p_sent_count" integer, "p_now" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    AS $$

DECLARE
    v_base_time TIMESTAMP WITH TIME ZONE;
    v_days_to_add INT;
    v_expected_time TIMESTAMP WITH TIME ZONE;
    v_one_year_from_now TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1년 후 기준점 계산
    v_one_year_from_now := p_now + INTERVAL '1 year';

    -- base_time 초기화
    v_base_time := COALESCE(p_base_time, p_now);

    -- 안전장치 1: base_time이 1년 이상 미래라면 현재 시간으로 보정
    IF v_base_time > v_one_year_from_now THEN
        RAISE WARNING 'base_time이 너무 먼 미래입니다. 현재 시간으로 보정: base_time=%, now=%', v_base_time, p_now;
        v_base_time := p_now;
    END IF;

    -- 승수 간격 계산 (sent_count는 이미 9로 제한되어 있음, 최대 256일)
    v_days_to_add := power(2, p_sent_count - 1)::INT;

    RAISE DEBUG 'calculate_progressive_interval: p_base_time=%, p_sent_count=%, p_now=%, v_days_to_add=%',
        p_base_time, p_sent_count, p_now, v_days_to_add;

    -- 과거 시간 보정
    IF v_base_time < p_now THEN
        RAISE DEBUG 'base_time이 과거입니다. 현재 시간으로 보정';
        v_base_time := p_now;
    END IF;

    -- 안전장치 2: 날짜 추가 시도 (overflow 예외 처리)
    -- PostgreSQL timestamp 범위: 4713 BC to 294276 AD
    BEGIN
        v_expected_time := v_base_time + (v_days_to_add || ' days')::INTERVAL;

        -- 안전장치 3: 계산 결과가 1년 이상 미래라면 제한 (비정상 데이터 보호)
        IF v_expected_time > v_one_year_from_now THEN
            RAISE WARNING 'calculated time이 1년을 초과합니다. 제한 적용: calculated=%, limit=%',
                v_expected_time, v_one_year_from_now;
            -- 1년 이상 미래는 현재 + 256일로 제한
            v_expected_time := p_now + INTERVAL '256 days';
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- overflow나 기타 에러 발생 시 안전한 기본값 사용
        RAISE WARNING 'timestamp 계산 중 오류 발생: %, SQLSTATE: %. 기본값(현재 + 256일) 사용', SQLERRM, SQLSTATE;
        v_expected_time := p_now + INTERVAL '256 days';
    END;

    -- 정각으로 설정
    v_expected_time := date_trunc('hour', v_expected_time);

    RAISE DEBUG 'calculate_progressive_interval: returning %', v_expected_time;
    RETURN v_expected_time;
END;

$$;


ALTER FUNCTION "public"."calculate_progressive_interval"("p_base_time" timestamp with time zone, "p_sent_count" integer, "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_sort_position"("p_parent_type" "text", "p_parent_id" integer, "p_child_source_id" integer, "p_child_target_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."change_sort_position"("p_parent_type" "text", "p_parent_id" integer, "p_child_source_id" integer, "p_child_target_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."folder_delete_trigger_func"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.folder_deleted(id, user_id)
  VALUES (OLD.id, OLD.user_id);
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."folder_delete_trigger_func"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dynamic_pages_chunk"("last_created_at" timestamp with time zone, "last_id" "text", "target_size" integer DEFAULT 700000, "max_limit" integer DEFAULT 50) RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_size integer := 0;
  v_row public.page%ROWTYPE;
  v_count integer := 0;
  v_user_id uuid;
  v_pages public.page[] := '{}';
  v_has_more boolean := false;
BEGIN
  -- 현재 인증된 사용자 ID 가져오기
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.page
    WHERE user_id = v_user_id
    AND (
      last_created_at IS NULL 
      OR (created_at, id) > (last_created_at, last_id)
    )
    ORDER BY created_at ASC, id ASC
    LIMIT max_limit + 1 -- 다음 데이터 존재 여부 확인을 위해 1개 더 조회
  LOOP
    -- 개수 제한 체크 (max_limit + 1 번째 데이터인 경우)
    IF v_count >= max_limit THEN
      v_has_more := true;
      EXIT;
    END IF;

    -- 용량 누적 계산 (문자 수 기준)
    -- page.length는 title.length + body.length로 저장된 문자 수
    -- body는 원본 HTML 문자열(태그 포함)의 길이를 사용 (동기화 시 실제 전송되는 데이터 크기 반영)
    -- length가 null이면 title.length + body.length로 대체, 둘 다 null이면 0
    -- 단위: 문자 수(character count), 바이트가 아님
    v_current_size := v_current_size + COALESCE(
      v_row.length, 
      (LENGTH(COALESCE(v_row.title, '')) + LENGTH(COALESCE(v_row.body, ''))), 
      0
    );
    
    -- 페이지 배열에 추가
    v_pages := array_append(v_pages, v_row);
    v_count := v_count + 1;

    -- 목표 크기에 도달했는지 확인 (문자 수 기준)
    IF v_current_size >= target_size THEN
      -- 용량 때문에 멈추는 경우, 뒤에 데이터가 더 있는지 별도로 확인
      -- 현재 v_row가 max_limit보다는 적은 상태에서 멈춘 것임
      SELECT EXISTS (
        SELECT 1
        FROM public.page
        WHERE user_id = v_user_id
        AND (created_at, id) > (v_row.created_at, v_row.id)
        LIMIT 1
      ) INTO v_has_more;
      
      EXIT;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'pages', COALESCE(array_to_json(v_pages), '[]'::json),
    'hasMore', v_has_more
  );
END;
$$;


ALTER FUNCTION "public"."get_dynamic_pages_chunk"("last_created_at" timestamp with time zone, "last_id" "text", "target_size" integer, "max_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_page_parents"("page_id" bigint) RETURNS TABLE("id" bigint, "parent_page_id" bigint, "path" "text", "meta" "jsonb")
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  with recursive chain as (
    select *
    from nods_page
    where id = page_id

    union all

    select child.*
      from nods_page as child
      join chain on chain.parent_page_id = child.id
  )
  select id, parent_page_id, path, meta
  from chain;
$$;


ALTER FUNCTION "public"."get_page_parents"("page_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "input_page_id" "text" DEFAULT NULL::"text") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision, "page_id" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity,
    documents.page_id
FROM documents
WHERE 
    1 - (documents.embedding <=> query_embedding) > match_threshold AND 
    (input_page_id IS NULL OR documents.page_id = input_page_id) -- 수정된 매개변수 이름을 사용
ORDER BY similarity DESC
LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_documents"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "input_page_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_page_sections"("embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "min_content_length" integer) RETURNS TABLE("id" bigint, "page_id" bigint, "slug" "text", "heading" "text", "content" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
#variable_conflict use_variable
begin
  return query
  select
    nods_page_section.id,
    nods_page_section.page_id,
    nods_page_section.slug,
    nods_page_section.heading,
    nods_page_section.content,
    (nods_page_section.embedding <#> embedding) * -1 as similarity
  from nods_page_section

  -- We only care about sections that have a useful amount of content
  where length(nods_page_section.content) >= min_content_length

  -- The dot product is negative because of a Postgres limitation, so we negate it
  and (nods_page_section.embedding <#> embedding) * -1 > match_threshold

  -- OpenAI embeddings are normalized to length 1, so
  -- cosine similarity and dot product will produce the same results.
  -- Using dot product which can be computed slightly faster.
  --
  -- For the different syntaxes, see https://github.com/pgvector/pgvector
  order by nods_page_section.embedding <#> embedding

  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_page_sections"("embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "min_content_length" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_pages"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "exclude_id" integer) RETURNS TABLE("id" bigint, "title" "text", "body" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select
    pages.id,
    pages.title,
    pages.body,
    1 - (pages.embedding <=> query_embedding) as similarity
  from pages
  -- where 1 - (pages.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;


ALTER FUNCTION "public"."match_pages"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "exclude_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_topics"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" bigint, "title" "text", "body" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select
    topics.id,
    topics.title,
    topics.body,
    1 - (topics.embedding <=> query_embedding) as similarity
  from topics
  -- where 1 - (topics.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;


ALTER FUNCTION "public"."match_topics"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."page_delete_trigger_func"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.page_deleted(id, user_id)
  VALUES (OLD.id, OLD.user_id);
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."page_delete_trigger_func"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_alarms_atomically"("p_current_time" timestamp with time zone DEFAULT "now"(), "p_batch_limit" integer DEFAULT 100) RETURNS TABLE("alarm_id" "text", "page_id" "text", "user_id" "uuid", "old_next_alarm_time" timestamp with time zone, "new_next_alarm_time" timestamp with time zone, "sent_count" integer, "title" "text", "body" "text", "timezone" "text", "processing_time_ms" integer, "error_reason" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_alarm RECORD;
    v_calculated_time TIMESTAMP WITH TIME ZONE;
    v_final_time TIMESTAMP WITH TIME ZONE;
    v_start_time TIMESTAMP WITH TIME ZONE;
    v_end_time TIMESTAMP WITH TIME ZONE;
    v_normalized_sent_count integer;
BEGIN
    RAISE LOG 'process_alarms_atomically start: current_time=%, batch_limit=%', p_current_time, p_batch_limit;
    
    FOR v_alarm IN 
        UPDATE public.alarm a
        SET processed_at = p_current_time
        FROM (
            SELECT 
                sub.page_id,
                sub.id as alarm_id,
                sub.user_id,
                sub.next_alarm_time,
                sub.sent_count,
                LEFT(p.title, 2000) as title,
                LEFT(p.body, 2000) as body,
                COALESCE(ui.timezone, 'Asia/Seoul') as user_timezone
            FROM public.alarm sub
            LEFT JOIN public.page p ON p.id = sub.page_id
            LEFT JOIN public.user_info ui ON ui.user_id = sub.user_id
            WHERE 
                (sub.next_alarm_time <= p_current_time + INTERVAL '12 hours' OR sub.sent_count = 1)
                AND (sub.processed_at IS NULL OR sub.processed_at < p_current_time - INTERVAL '6 hours')
            ORDER BY sub.next_alarm_time ASC NULLS LAST
            LIMIT p_batch_limit
            FOR UPDATE OF sub SKIP LOCKED
        ) target_data
        WHERE a.id = target_data.alarm_id
        RETURNING 
            target_data.alarm_id as id,
            target_data.page_id,
            target_data.user_id,
            target_data.next_alarm_time,
            target_data.sent_count,
            target_data.title,
            target_data.body,
            target_data.user_timezone
    LOOP
        BEGIN
            v_start_time := clock_timestamp();
            v_normalized_sent_count := LEAST(v_alarm.sent_count, 9);
            
            v_calculated_time := calculate_progressive_interval(
                v_alarm.next_alarm_time, 
                v_normalized_sent_count,
                p_current_time
            );
            
            v_calculated_time := adjust_for_sleep_time(
                v_calculated_time, 
                v_alarm.user_timezone
            );

            -- 안전장치: 어떤 경우에도 알람 시간이 과거로 설정되지 않도록 보장
            v_final_time := GREATEST(
                v_calculated_time,
                p_current_time + INTERVAL '1 minute'
            );
            
            UPDATE public.alarm 
            SET next_alarm_time = v_final_time,
                sent_count = v_normalized_sent_count + 1
            WHERE id = v_alarm.id; -- ✅ 특정 알람만 정확히 업데이트
            
            v_end_time := clock_timestamp();
            
            RETURN QUERY SELECT 
                v_alarm.id,
                v_alarm.page_id,
                v_alarm.user_id,
                v_alarm.next_alarm_time,
                v_final_time,
                v_normalized_sent_count + 1,
                v_alarm.title,
                v_alarm.body,
                v_alarm.user_timezone,
                FLOOR(1000 * EXTRACT(EPOCH FROM (v_end_time - v_start_time)))::INT,
                NULL::text;
                
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE LOG 'Alarm processing failed: alarm_id=%, page_id=%, user_id=%, sent_count=%, error=%, sqlstate=%', 
                    v_alarm.id, v_alarm.page_id, v_alarm.user_id, v_alarm.sent_count, SQLERRM, SQLSTATE;
                
                v_end_time := clock_timestamp();
                
                RETURN QUERY SELECT 
                    v_alarm.id,
                    v_alarm.page_id,
                    v_alarm.user_id,
                    v_alarm.next_alarm_time,
                    v_alarm.next_alarm_time,
                    v_alarm.sent_count,
                    v_alarm.title,
                    v_alarm.body,
                    v_alarm.user_timezone,
                    FLOOR(1000 * EXTRACT(EPOCH FROM (v_end_time - v_start_time)))::INT,
                    SQLSTATE || ': ' || SQLERRM;
        END;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."process_alarms_atomically"("p_current_time" timestamp with time zone, "p_batch_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_page"("keyword" "text", "additional_condition" "text" DEFAULT ''::"text", "order_by" "text" DEFAULT ''::"text", "limit_result" integer DEFAULT NULL::integer, "offset_result" integer DEFAULT 0) RETURNS TABLE("id" integer, "title" "text", "body" "text", "user_id" "uuid", "is_public" boolean, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."search_page"("keyword" "text", "additional_condition" "text", "order_by" "text", "limit_result" integer, "offset_result" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_created_month"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- created_at의 연도와 월을 추출하고 일을 '1'로 설정하여 created_month에 할당
    NEW.created_month := date_trunc('month', NEW.created_at)::date;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_created_month"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_quota"("p_user_id" "uuid", "p_api_type_id" integer, "p_usage_amount" numeric, "p_free_plan_limit" numeric, "p_subscription_plan_limit" numeric) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_api_price numeric;
    v_api_call_price numeric;
    v_updated_quota numeric;
BEGIN
    -- API 가격을 가져옴
    SELECT price, call_price INTO STRICT v_api_price, v_api_call_price
    FROM api_type
    WHERE id = p_api_type_id;

    -- usage 테이블의 current_quota 및 status 업데이트
    UPDATE usage
    SET current_quota = current_quota + (v_api_price * p_usage_amount) + v_api_call_price,
        status = CASE
                    WHEN current_quota + (v_api_price * p_usage_amount) + v_api_call_price >
                         CASE 
                             WHEN plan_type = 'FREE' THEN p_free_plan_limit 
                             ELSE p_subscription_plan_limit 
                         END
                    THEN CASE
                             WHEN plan_type = 'FREE' THEN 'INACTIVE_FREE_USAGE_EXCEEDED'::subscription_status
                             ELSE 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED'::subscription_status
                         END
                    ELSE status
                 END
    WHERE user_id = p_user_id
    RETURNING current_quota INTO v_updated_quota;

    -- 사용자 ID가 존재하지 않는 경우 예외 처리
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with ID % not found in usage table', p_user_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."set_quota"("p_user_id" "uuid", "p_api_type_id" integer, "p_usage_amount" numeric, "p_free_plan_limit" numeric, "p_subscription_plan_limit" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_alarm_updated_at_except_processed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- processed_at 필드만 변경된 경우 updated_at을 갱신하지 않음
    IF OLD.processed_at IS DISTINCT FROM NEW.processed_at 
       AND (OLD.updated_at IS NOT DISTINCT FROM NEW.updated_at OR NEW.updated_at IS NULL) THEN
        -- processed_at만 변경된 경우 updated_at을 현재 시간으로 설정하지 않음
        NEW.updated_at := OLD.updated_at;
        RETURN NEW;
    END IF;

    -- 다른 필드가 변경된 경우 기존 로직 적용
    -- 사용자가 명시적으로 updated_at을 설정한 경우 (NULL이 아닌 경우) 보존
    IF NEW.updated_at IS NOT NULL AND NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        -- 사용자가 직접 값을 설정한 경우는 유지
        RETURN NEW;
    END IF;

    -- 사용자가 updated_at을 설정하지 않았거나 NULL로 설정한 경우에만 NOW()로 설정
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_alarm_updated_at_except_processed_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_book_child_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."book" SET child_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE book_id = NEW.book_id) WHERE id = NEW.book_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."book" SET child_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE book_id = OLD.book_id) WHERE id = OLD.book_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_book_child_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_book_parent_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."book" SET parent_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE book_id = NEW.book_id) WHERE id = NEW.book_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."book" SET parent_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE book_id = OLD.book_id) WHERE id = OLD.book_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_book_parent_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_consent_times"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- For marketing consent
  IF NEW.marketing_consent_version IS DISTINCT FROM OLD.marketing_consent_version OR TG_OP = 'INSERT' THEN
    NEW.marketing_consent_update_at = NOW();
  END IF;

  -- For privacy policy consent
  IF NEW.privacy_policy_consent_version IS DISTINCT FROM OLD.privacy_policy_consent_version OR TG_OP = 'INSERT' THEN
    NEW.privacy_policy_consent_updated_at = NOW();
  END IF;

  -- For terms of service consent
  IF NEW.terms_of_service_consent_version IS DISTINCT FROM OLD.terms_of_service_consent_version OR TG_OP = 'INSERT' THEN
    NEW.terms_of_service_consent_update_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_consent_times"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_folder_page_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- NEW.folder_id가 있는 경우 해당 폴더 업데이트
    IF NEW.folder_id IS NOT NULL THEN
      UPDATE "public"."folder" 
      SET page_count = (SELECT COUNT(*) FROM "public"."page" WHERE folder_id = NEW.folder_id),
          last_page_added_at = now()
      WHERE id = NEW.folder_id;
    END IF;
    
    -- UPDATE의 경우 이전 폴더도 업데이트 (folder_id가 변경된 경우)
    IF TG_OP = 'UPDATE' AND OLD.folder_id IS NOT NULL AND OLD.folder_id != NEW.folder_id THEN
      UPDATE "public"."folder" 
      SET page_count = (SELECT COUNT(*) FROM "public"."page" WHERE folder_id = OLD.folder_id)
      WHERE id = OLD.folder_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- OLD.folder_id가 있는 경우 해당 폴더 업데이트
    IF OLD.folder_id IS NOT NULL THEN
      UPDATE "public"."folder" 
      SET page_count = (SELECT COUNT(*) FROM "public"."page" WHERE folder_id = OLD.folder_id)
      WHERE id = OLD.folder_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_folder_page_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_folder_page_count"() IS '폴더의 페이지 수를 자동으로 업데이트하는 트리거 함수';



CREATE OR REPLACE FUNCTION "public"."update_last_viewed_at"("page_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.page
    SET last_viewed_at = now()
    WHERE id = page_id;
END;
$$;


ALTER FUNCTION "public"."update_last_viewed_at"("page_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_library_child_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."library" SET child_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE library_id = NEW.library_id) WHERE id = NEW.library_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."library" SET child_count = (SELECT COUNT(*) FROM "public"."library_book_mapping" WHERE library_id = OLD.library_id) WHERE id = OLD.library_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_library_child_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_ids_batch"("p_notification_updates" "jsonb") RETURNS TABLE("updated_count" integer, "failed_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total_count integer;
    v_updated_count integer := 0;
    v_failed_count integer := 0;
    v_current_time timestamp with time zone := NOW();
BEGIN
    -- 입력 데이터 개수 확인
    v_total_count := jsonb_array_length(p_notification_updates);
    
    -- 빈 입력 처리
    IF v_total_count = 0 THEN
        RETURN QUERY SELECT 0, 0;
        RETURN;
    END IF;
    
    -- 단일 UPDATE 문으로 모든 알람을 한 번에 업데이트 (최적화된 성능)
    WITH update_data AS (
        SELECT 
            (elem->>'alarm_id')::text AS alarm_id,
            (elem->>'notification_id')::text AS notification_id
        FROM jsonb_array_elements(p_notification_updates) AS elem
        WHERE elem->>'alarm_id' IS NOT NULL 
        AND elem->>'notification_id' IS NOT NULL
        AND trim(elem->>'alarm_id') != ''
        AND trim(elem->>'notification_id') != ''
    ),
    updated_alarms AS (
        UPDATE alarm 
        SET 
            last_notification_id = update_data.notification_id,
            updated_at = v_current_time
        FROM update_data
        WHERE alarm.id = update_data.alarm_id
        RETURNING alarm.id
    )
    SELECT COUNT(*)::integer INTO v_updated_count FROM updated_alarms;
    
    -- 실패한 업데이트 개수 계산
    v_failed_count := v_total_count - v_updated_count;
    
    -- 성능상 중요하지 않은 경우에만 로깅 (조건부)
    IF v_failed_count > 0 OR v_total_count > 50 THEN
        RAISE LOG 'update_notification_ids_batch: total=%, updated=%, failed=%', 
            v_total_count, v_updated_count, v_failed_count;
    END IF;
    
    -- 결과 반환
    RETURN QUERY SELECT v_updated_count, v_failed_count;
END;
$$;


ALTER FUNCTION "public"."update_notification_ids_batch"("p_notification_updates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_page_parent_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "public"."page" SET parent_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE page_id = NEW.page_id) WHERE id = NEW.page_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."page" SET parent_count = (SELECT COUNT(*) FROM "public"."book_page_mapping" WHERE page_id = OLD.page_id) WHERE id = OLD.page_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_page_parent_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_registered_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- accepted가 true로 변경되었는지 확인
    IF NEW.accepted = true THEN
        -- registered_at을 현재 시간으로 갱신
        NEW.registered_at = now();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_registered_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- 사용자가 명시적으로 updated_at을 설정한 경우 (NULL이 아닌 경우) 보존
    IF NEW.updated_at IS NOT NULL AND NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        -- 사용자가 직접 값을 설정한 경우는 유지
        RETURN NEW;
    END IF;

    -- 사용자가 updated_at을 설정하지 않았거나 NULL로 설정한 경우에만 NOW()로 설정
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."alarm" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "next_alarm_time" timestamp with time zone,
    "page_id" "text" NOT NULL,
    "last_notification_id" "text",
    "sent_count" integer DEFAULT 1,
    "processed_at" timestamp with time zone,
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alarm" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alarm_deleted" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL
);


ALTER TABLE "public"."alarm_deleted" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_type" (
    "id" integer NOT NULL,
    "vendor_id" integer,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "version" character varying(10),
    "price" numeric NOT NULL,
    "currency" character varying(3) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "call_price" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."api_type" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_usage_purpose" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_usage_purpose" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_vendors" (
    "id" integer NOT NULL,
    "name" character varying(50) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_tester" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "registered_at" timestamp with time zone,
    "accepted" boolean DEFAULT false,
    "user_id" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."beta_tester" OWNER TO "postgres";


ALTER TABLE "public"."beta_tester" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."beta_tester_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."custom_prompts" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title_prompt" "text",
    "body_prompt" "text",
    "photo_prompt" "text",
    "ocr_prompt" "text",
    "reminder_prompt" "text",
    "extra_prompt" "text",
    "extra_prompt_1" "text",
    "extra_prompt_2" "text",
    "extra_prompt_3" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_prompts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb",
    "embedding" "extensions"."vector"(1024),
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "page_id" "text",
    "is_public" boolean DEFAULT false
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."documents_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."documents_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."documents_id_seq" OWNED BY "public"."documents"."id";



CREATE TABLE IF NOT EXISTS "public"."folder" (
    "id" "text" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "page_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_page_added_at" timestamp with time zone
);


ALTER TABLE "public"."folder" OWNER TO "postgres";


COMMENT ON TABLE "public"."folder" IS '페이지를 그룹핑하는 폴더 테이블';



COMMENT ON COLUMN "public"."folder"."id" IS '폴더 고유 식별자 (ULID 형식)';



COMMENT ON COLUMN "public"."folder"."user_id" IS '폴더 소유자 사용자 ID';



COMMENT ON COLUMN "public"."folder"."name" IS '폴더명';



COMMENT ON COLUMN "public"."folder"."description" IS '폴더 설명 (선택적)';



COMMENT ON COLUMN "public"."folder"."thumbnail_url" IS '폴더 썸네일 이미지 URL (선택적)';



COMMENT ON COLUMN "public"."folder"."page_count" IS '폴더에 속한 페이지 수 (트리거로 자동 관리)';



COMMENT ON COLUMN "public"."folder"."created_at" IS '폴더 생성 시간';



COMMENT ON COLUMN "public"."folder"."updated_at" IS '폴더 정보 마지막 수정 시간';



COMMENT ON COLUMN "public"."folder"."last_page_added_at" IS '마지막으로 페이지가 추가된 시간';



CREATE TABLE IF NOT EXISTS "public"."folder_deleted" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL
);


ALTER TABLE "public"."folder_deleted" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "scheduled_time" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "payload" "text",
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "last_running_at" timestamp with time zone,
    "status" "public"."job_status"
);


ALTER TABLE "public"."job_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "is_public" boolean DEFAULT false,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "child_count" integer DEFAULT 0,
    "parent_count" integer DEFAULT 0,
    "last_embedded_at" timestamp with time zone,
    "last_viewed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "img_url" "text",
    "length" integer,
    "type" "public"."page_type" DEFAULT 'text'::"public"."page_type" NOT NULL,
    "folder_id" "text"
);


ALTER TABLE "public"."page" OWNER TO "postgres";


COMMENT ON COLUMN "public"."page"."folder_id" IS '페이지가 속한 폴더 ID (선택적, folder 테이블 참조)';



CREATE TABLE IF NOT EXISTS "public"."page_deleted" (
    "id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL
);


ALTER TABLE "public"."page_deleted" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_payment_type_price" (
    "id" bigint NOT NULL,
    "product_payment_type_id" bigint NOT NULL,
    "amount" numeric NOT NULL,
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_payment_type_price" OWNER TO "postgres";


ALTER TABLE "public"."product_payment_type_price" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."prouduct_payment_type_price_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."superuser" (
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."superuser" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_info" (
    "id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nickname" "text",
    "marketing_consent_update_at" timestamp with time zone,
    "marketing_consent_version" "text",
    "privacy_policy_consent_updated_at" timestamp with time zone,
    "privacy_policy_consent_version" "text",
    "terms_of_service_consent_update_at" timestamp with time zone,
    "terms_of_service_consent_version" "text",
    "profile_img_url" "text",
    "timezone" "text" DEFAULT 'Asia/Seoul'::"text" NOT NULL
);


ALTER TABLE "public"."user_info" OWNER TO "postgres";


ALTER TABLE "public"."user_info" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_info_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."documents" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."documents_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alarm_deleted"
    ADD CONSTRAINT "alarm_deleted_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alarm"
    ADD CONSTRAINT "alarm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_type"
    ADD CONSTRAINT "api_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_usage_purpose"
    ADD CONSTRAINT "api_usage_purpose_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_vendors"
    ADD CONSTRAINT "api_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_tester"
    ADD CONSTRAINT "beta_tester_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_tester"
    ADD CONSTRAINT "beta_tester_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."custom_prompts"
    ADD CONSTRAINT "custom_prompts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folder_deleted"
    ADD CONSTRAINT "folder_deleted_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folder"
    ADD CONSTRAINT "folder_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_queue"
    ADD CONSTRAINT "job_queue_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_deleted"
    ADD CONSTRAINT "page_deleted_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page"
    ADD CONSTRAINT "pages_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_payment_type_price"
    ADD CONSTRAINT "prouduct_payment_type_price_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."superuser"
    ADD CONSTRAINT "superuser_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."alarm"
    ADD CONSTRAINT "unique_page_alarm" UNIQUE ("page_id");



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "user_info_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "user_info_user_id_key" UNIQUE ("user_id");



CREATE INDEX "documents_embedding_idx" ON "public"."documents" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops");



CREATE INDEX "folder_user_id_idx" ON "public"."folder" USING "btree" ("user_id");



CREATE INDEX "idx_alarm_next_time_processed_at" ON "public"."alarm" USING "btree" ("next_alarm_time", "processed_at") WHERE ("next_alarm_time" IS NOT NULL);



CREATE INDEX "idx_alarm_page_id" ON "public"."alarm" USING "btree" ("page_id");



CREATE INDEX "idx_alarm_processed_at" ON "public"."alarm" USING "btree" ("processed_at");



CREATE INDEX "idx_alarm_processing_simple" ON "public"."alarm" USING "btree" ("next_alarm_time", "processed_at");



CREATE INDEX "idx_alarm_sent_count_1" ON "public"."alarm" USING "btree" ("sent_count") WHERE ("sent_count" = 1);



CREATE INDEX "idx_alarm_user_page" ON "public"."alarm" USING "btree" ("user_id", "page_id");



CREATE INDEX "idx_user_info_timezone" ON "public"."user_info" USING "btree" ("user_id", "timezone");



CREATE INDEX "ix_page_title_body" ON "public"."page" USING "pgroonga" (((("title" || ' '::"text") || "body")));



CREATE INDEX "page_folder_id_idx" ON "public"."page" USING "btree" ("folder_id");



CREATE INDEX "page_user_id_created_at_id_idx" ON "public"."page" USING "btree" ("user_id", "created_at", "id");



CREATE INDEX "page_user_id_idx" ON "public"."page" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "alarm_before_delete_trigger" BEFORE DELETE ON "public"."alarm" FOR EACH ROW EXECUTE FUNCTION "public"."alarm_delete_trigger_func"();



CREATE OR REPLACE TRIGGER "folder_before_delete_trigger" BEFORE DELETE ON "public"."folder" FOR EACH ROW EXECUTE FUNCTION "public"."folder_delete_trigger_func"();



CREATE OR REPLACE TRIGGER "folder_updated_at_trigger" BEFORE UPDATE ON "public"."folder" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "page_before_delete_trigger" BEFORE DELETE ON "public"."page" FOR EACH ROW EXECUTE FUNCTION "public"."page_delete_trigger_func"();



CREATE OR REPLACE TRIGGER "page_folder_count_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."page" FOR EACH ROW EXECUTE FUNCTION "public"."update_folder_page_count"();



CREATE OR REPLACE TRIGGER "trigger_update_registered_at" BEFORE UPDATE ON "public"."beta_tester" FOR EACH ROW WHEN (("old"."accepted" IS DISTINCT FROM "new"."accepted")) EXECUTE FUNCTION "public"."update_registered_at"();



CREATE OR REPLACE TRIGGER "update_alarm_modified_time" BEFORE UPDATE ON "public"."alarm" FOR EACH ROW EXECUTE FUNCTION "public"."update_alarm_updated_at_except_processed_at"();



CREATE OR REPLACE TRIGGER "update_consent_times_trigger" BEFORE UPDATE ON "public"."user_info" FOR EACH ROW EXECUTE FUNCTION "public"."update_consent_times"();



CREATE OR REPLACE TRIGGER "update_consent_times_trigger_insert" BEFORE INSERT ON "public"."user_info" FOR EACH ROW EXECUTE FUNCTION "public"."update_consent_times"();



CREATE OR REPLACE TRIGGER "update_consent_times_trigger_update" BEFORE UPDATE ON "public"."user_info" FOR EACH ROW EXECUTE FUNCTION "public"."update_consent_times"();



ALTER TABLE ONLY "public"."alarm"
    ADD CONSTRAINT "alarm_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alarm"
    ADD CONSTRAINT "alarm_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_type"
    ADD CONSTRAINT "api_types_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."api_vendors"("id");



ALTER TABLE ONLY "public"."custom_prompts"
    ADD CONSTRAINT "custom_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folder"
    ADD CONSTRAINT "folder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."page"
    ADD CONSTRAINT "page_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."page"
    ADD CONSTRAINT "page_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."superuser"
    ADD CONSTRAINT "superuser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_info"
    ADD CONSTRAINT "user_info_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can delete their own alarms" ON "public"."alarm" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can insert their own alarms" ON "public"."alarm" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can select their own alarms" ON "public"."alarm" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Authenticated users can update their own alarms" ON "public"."alarm" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."alarm_deleted" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."folder_deleted" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."job_queue" FOR DELETE TO "authenticated", "service_role" USING ((("auth"."role"() = 'service_role'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Enable delete for users based on user_id" ON "public"."superuser" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for users based on user_id" ON "public"."alarm_deleted" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for users based on user_id" ON "public"."custom_prompts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable insert for users based on user_id" ON "public"."folder_deleted" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable read access for all users" ON "public"."api_type" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."api_usage_purpose" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."api_vendors" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."beta_tester" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."product_payment_type_price" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."superuser" FOR SELECT USING (true);



CREATE POLICY "Enable read for users based on user_id" ON "public"."alarm_deleted" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable read for users based on user_id" ON "public"."folder_deleted" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Enable update for users based on email" ON "public"."custom_prompts" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable users to view their own data only" ON "public"."custom_prompts" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own folders" ON "public"."folder" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own folders" ON "public"."folder" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can select their own folders" ON "public"."folder" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own folders" ON "public"."folder" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."alarm" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alarm_deleted" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_usage_purpose" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beta_tester" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_prompts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_owner_data_on_documents" ON "public"."documents" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "delete_owner_data_on_page" ON "public"."page" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "delete_user_data_by_user_id_on_page_deleted" ON "public"."page_deleted" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folder" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folder_deleted" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_authenticated_user_data_on_documents" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "insert_authenticated_user_data_on_page" ON "public"."page" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "insert_user_data_by_email_on_beta_tester" ON "public"."beta_tester" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "insert_user_data_by_user_id_on_job_queue" ON "public"."job_queue" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "insert_user_data_by_user_id_on_page_deleted" ON "public"."page_deleted" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "insert_user_data_by_user_id_on_user_info" ON "public"."user_info" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."job_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_deleted" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_payment_type_price" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_public_or_owner_private_data_on_documents" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("is_public" = true) OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "select_public_or_owner_private_data_on_page" ON "public"."page" FOR SELECT USING (((("is_public" = false) AND (( SELECT "auth"."uid"() AS "uid") = "user_id")) OR ("is_public" = true)));



CREATE POLICY "select_user_data_by_user_id_on_job_queue" ON "public"."job_queue" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "select_user_data_by_user_id_on_page_deleted" ON "public"."page_deleted" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "select_user_data_by_user_id_on_user_info" ON "public"."user_info" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."superuser" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_owner_data_on_page" ON "public"."page" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "update_owner_data_on_user_info" ON "public"."user_info" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "update_user_data_by_email_on_beta_tester" ON "public"."beta_tester" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "update_user_data_by_email_on_job_queue" ON "public"."job_queue" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_info" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."_add"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_add"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_add"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_add"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_add"("text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_add"("text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_add"("text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_add"("text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_alike"(boolean, "anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_alike"(boolean, "anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_alike"(boolean, "anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_alike"(boolean, "anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", "name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", "name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", "name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ancestor_of"("name", "name", "name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_are"("text", "name"[], "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_are"("text", "name"[], "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_are"("text", "name"[], "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_are"("text", "name"[], "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_areni"("text", "text"[], "text"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_areni"("text", "text"[], "text"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_areni"("text", "text"[], "text"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_areni"("text", "text"[], "text"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_array_to_sorted_string"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_array_to_sorted_string"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_array_to_sorted_string"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_array_to_sorted_string"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_assets_are"("text", "text"[], "text"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_assets_are"("text", "text"[], "text"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_assets_are"("text", "text"[], "text"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_assets_are"("text", "text"[], "text"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cast_exists"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "name", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "name", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "name", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cdi"("name", "name", "name", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cexists"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cexists"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_cexists"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cexists"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_cexists"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cexists"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_cexists"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cexists"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_ckeys"("name", character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_ckeys"("name", character) TO "anon";
GRANT ALL ON FUNCTION "public"."_ckeys"("name", character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ckeys"("name", character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_ckeys"("name", "name", character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_ckeys"("name", "name", character) TO "anon";
GRANT ALL ON FUNCTION "public"."_ckeys"("name", "name", character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ckeys"("name", "name", character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_cleanup"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_cleanup"() TO "anon";
GRANT ALL ON FUNCTION "public"."_cleanup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cleanup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_cmp_types"("oid", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_cmp_types"("oid", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_cmp_types"("oid", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_cmp_types"("oid", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "name", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "name", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "name", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_col_is_null"("name", "name", "name", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_constraint"("name", character, "name"[], "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_constraint"("name", character, "name"[], "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_constraint"("name", character, "name"[], "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_constraint"("name", character, "name"[], "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_constraint"("name", "name", character, "name"[], "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_constraint"("name", "name", character, "name"[], "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_constraint"("name", "name", character, "name"[], "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_constraint"("name", "name", character, "name"[], "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_contract_on"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_contract_on"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."_contract_on"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_contract_on"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_currtest"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_currtest"() TO "anon";
GRANT ALL ON FUNCTION "public"."_currtest"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_currtest"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_db_privs"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_db_privs"() TO "anon";
GRANT ALL ON FUNCTION "public"."_db_privs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_db_privs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_def_is"("text", "text", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_def_is"("text", "text", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_def_is"("text", "text", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_def_is"("text", "text", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_definer"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_definer"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_definer"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_definer"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_definer"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_definer"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_definer"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_definer"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_dexists"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_dexists"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_dexists"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_dexists"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_dexists"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_dexists"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_dexists"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_dexists"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_do_ne"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_do_ne"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_do_ne"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_do_ne"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_docomp"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_docomp"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_docomp"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_docomp"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_error_diag"("text", "text", "text", "text", "text", "text", "text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_error_diag"("text", "text", "text", "text", "text", "text", "text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_error_diag"("text", "text", "text", "text", "text", "text", "text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_error_diag"("text", "text", "text", "text", "text", "text", "text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_expand_context"(character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_expand_context"(character) TO "anon";
GRANT ALL ON FUNCTION "public"."_expand_context"(character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_expand_context"(character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_expand_on"(character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_expand_on"(character) TO "anon";
GRANT ALL ON FUNCTION "public"."_expand_on"(character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_expand_on"(character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_expand_vol"(character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_expand_vol"(character) TO "anon";
GRANT ALL ON FUNCTION "public"."_expand_vol"(character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_expand_vol"(character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_ext_exists"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_ext_exists"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_ext_exists"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ext_exists"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_ext_exists"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_ext_exists"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_ext_exists"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ext_exists"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_extensions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_extensions"() TO "anon";
GRANT ALL ON FUNCTION "public"."_extensions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_extensions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_extensions"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_extensions"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_extensions"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_extensions"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_extras"(character[], "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_extras"(character[], "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_extras"(character[], "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_extras"(character[], "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_extras"(character, "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_extras"(character, "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_extras"(character, "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_extras"(character, "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_extras"(character[], "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_extras"(character[], "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_extras"(character[], "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_extras"(character[], "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_extras"(character, "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_extras"(character, "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_extras"(character, "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_extras"(character, "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_finish"(integer, integer, integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_finish"(integer, integer, integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_finish"(integer, integer, integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_finish"(integer, integer, integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_fkexists"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_fprivs_are"("text", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_fprivs_are"("text", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_fprivs_are"("text", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_fprivs_are"("text", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "anyelement", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "anyelement", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "anyelement", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "anyelement", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], "anyelement", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], "anyelement", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], "anyelement", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_func_compare"("name", "name", "name"[], "anyelement", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_funkargs"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_funkargs"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_funkargs"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_funkargs"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_get"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_ac_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_ac_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_ac_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_ac_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_col_ns_type"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_col_ns_type"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_col_ns_type"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_col_ns_type"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_col_privs"("name", "text", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_col_privs"("name", "text", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_col_privs"("name", "text", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_col_privs"("name", "text", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_col_type"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_context"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_context"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_context"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_context"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_db_owner"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_db_owner"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_db_owner"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_db_owner"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_db_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_db_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_db_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_db_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_dtype"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_dtype"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_dtype"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_dtype"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_dtype"("name", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_dtype"("name", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_get_dtype"("name", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_dtype"("name", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_fdw_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_fdw_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_fdw_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_fdw_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_func_owner"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_func_privs"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_func_privs"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_func_privs"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_func_privs"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_index_owner"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_lang_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_lang_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_lang_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_lang_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_language_owner"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_language_owner"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_language_owner"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_language_owner"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_latest"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_latest"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_latest"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_latest"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_latest"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_latest"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_get_latest"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_latest"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_note"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_note"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_get_note"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_note"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_note"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_note"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_note"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_note"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_opclass_owner"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character[], "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_rel_owner"(character, "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_schema_owner"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_schema_owner"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_schema_owner"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_schema_owner"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_schema_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_schema_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_schema_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_schema_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_sequence_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_sequence_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_sequence_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_sequence_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_server_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_server_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_server_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_server_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_table_privs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_table_privs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_table_privs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_table_privs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_tablespace_owner"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_tablespace_owner"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_tablespace_owner"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_tablespace_owner"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_tablespaceprivs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_tablespaceprivs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_tablespaceprivs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_tablespaceprivs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_type_owner"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_type_owner"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_type_owner"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_type_owner"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_get_type_owner"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_get_type_owner"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_get_type_owner"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_get_type_owner"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_got_func"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_got_func"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_got_func"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_got_func"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_got_func"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_got_func"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_got_func"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_got_func"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_grolist"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_grolist"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_grolist"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_grolist"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_has_def"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_has_def"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_has_def"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_has_def"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_has_def"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_has_def"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_has_def"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_has_def"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_has_group"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_has_group"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_has_group"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_has_group"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_has_role"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_has_role"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_has_role"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_has_role"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_has_type"("name", character[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_has_type"("name", character[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_has_type"("name", character[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_has_type"("name", character[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_has_type"("name", "name", character[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_has_type"("name", "name", character[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_has_type"("name", "name", character[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_has_type"("name", "name", character[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_has_user"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_has_user"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_has_user"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_has_user"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_hasc"("name", character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_hasc"("name", character) TO "anon";
GRANT ALL ON FUNCTION "public"."_hasc"("name", character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_hasc"("name", character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_hasc"("name", "name", character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_hasc"("name", "name", character) TO "anon";
GRANT ALL ON FUNCTION "public"."_hasc"("name", "name", character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_hasc"("name", "name", character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_have_index"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_have_index"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_have_index"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_have_index"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_have_index"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_have_index"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_have_index"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_have_index"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_ident_array_to_sorted_string"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_ident_array_to_sorted_string"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_ident_array_to_sorted_string"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ident_array_to_sorted_string"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_ident_array_to_string"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_ident_array_to_string"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_ident_array_to_string"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ident_array_to_string"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_ikeys"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_inherited"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_inherited"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_inherited"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_inherited"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_inherited"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_inherited"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_inherited"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_inherited"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_is_indexed"("name", "name", "text"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_is_indexed"("name", "name", "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_is_indexed"("name", "name", "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_is_indexed"("name", "name", "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_is_instead"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_is_schema"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_is_schema"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_is_schema"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_is_schema"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_is_super"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_is_super"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_is_super"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_is_super"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_is_trusted"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_is_trusted"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_is_trusted"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_is_trusted"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_is_verbose"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_is_verbose"() TO "anon";
GRANT ALL ON FUNCTION "public"."_is_verbose"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_is_verbose"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_keys"("name", character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_keys"("name", character) TO "anon";
GRANT ALL ON FUNCTION "public"."_keys"("name", character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_keys"("name", character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_keys"("name", "name", character) TO "postgres";
GRANT ALL ON FUNCTION "public"."_keys"("name", "name", character) TO "anon";
GRANT ALL ON FUNCTION "public"."_keys"("name", "name", character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_keys"("name", "name", character) TO "service_role";



GRANT ALL ON FUNCTION "public"."_lang"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_lang"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_lang"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_lang"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_lang"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_lang"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_lang"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_lang"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_missing"(character[], "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_missing"(character[], "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_missing"(character[], "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_missing"(character[], "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_missing"(character, "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_missing"(character, "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_missing"(character, "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_missing"(character, "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_missing"(character[], "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_missing"(character[], "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_missing"(character[], "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_missing"(character[], "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_missing"(character, "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_missing"(character, "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_missing"(character, "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_missing"(character, "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_nosuch"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_nosuch"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_nosuch"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_nosuch"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_op_exists"("name", "name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_opc_exists"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_opc_exists"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_opc_exists"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_opc_exists"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_opc_exists"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_opc_exists"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_opc_exists"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_opc_exists"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_partof"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_partof"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_partof"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_partof"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_partof"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_partof"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_partof"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_partof"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_parts"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_parts"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_parts"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_parts"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_parts"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_parts"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_parts"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_parts"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_pg_sv_column_array"("oid", smallint[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_pg_sv_column_array"("oid", smallint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_pg_sv_column_array"("oid", smallint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_pg_sv_column_array"("oid", smallint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_pg_sv_table_accessible"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."_pg_sv_table_accessible"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."_pg_sv_table_accessible"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_pg_sv_table_accessible"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_pg_sv_type_array"("oid"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_pg_sv_type_array"("oid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_pg_sv_type_array"("oid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_pg_sv_type_array"("oid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_prokind"("p_oid" "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."_prokind"("p_oid" "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."_prokind"("p_oid" "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_prokind"("p_oid" "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_query"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_query"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."_query"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_query"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_quote_ident_like"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_quote_ident_like"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_quote_ident_like"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_quote_ident_like"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_refine_vol"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_refine_vol"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."_refine_vol"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_refine_vol"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_relcomp"("text", "anyarray", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "anyarray", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "anyarray", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "anyarray", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_relcomp"("text", "text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_relexists"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_relexists"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_relexists"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_relexists"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_relexists"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_relexists"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_relexists"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_relexists"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_relne"("text", "anyarray", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_relne"("text", "anyarray", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_relne"("text", "anyarray", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_relne"("text", "anyarray", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_relne"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_relne"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_relne"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_relne"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_returns"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_returns"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_returns"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_returns"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_returns"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_returns"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_returns"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_returns"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_rexists"(character, "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_rexists"(character, "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_rexists"(character, "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_rexists"(character, "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_rexists"(character[], "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_rexists"(character, "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_rexists"(character, "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_rexists"(character, "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_rexists"(character, "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_rule_on"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_runem"("text"[], boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_runem"("text"[], boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_runem"("text"[], boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_runem"("text"[], boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_runner"("text"[], "text"[], "text"[], "text"[], "text"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_runner"("text"[], "text"[], "text"[], "text"[], "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_runner"("text"[], "text"[], "text"[], "text"[], "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_runner"("text"[], "text"[], "text"[], "text"[], "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_set"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_set"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_set"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_set"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_set"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_set"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_set"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_set"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_set"("text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_set"("text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_set"("text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_set"("text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_strict"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_strict"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_strict"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_strict"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_strict"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_strict"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_strict"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_strict"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_table_privs"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_table_privs"() TO "anon";
GRANT ALL ON FUNCTION "public"."_table_privs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_table_privs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_temptable"("anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_temptable"("anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_temptable"("anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_temptable"("anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_temptable"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_temptable"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_temptable"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_temptable"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_temptypes"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_temptypes"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."_temptypes"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_temptypes"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_time_trials"("text", integer, numeric) TO "postgres";
GRANT ALL ON FUNCTION "public"."_time_trials"("text", integer, numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."_time_trials"("text", integer, numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_time_trials"("text", integer, numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."_tlike"(boolean, "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_tlike"(boolean, "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_tlike"(boolean, "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_tlike"(boolean, "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_todo"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_todo"() TO "anon";
GRANT ALL ON FUNCTION "public"."_todo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_todo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_trig"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_trig"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_trig"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_trig"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_trig"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_trig"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_type_func"("char", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_type_func"("char", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_types_are"("name"[], "text", character[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_types_are"("name"[], "text", character[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_types_are"("name"[], "text", character[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_types_are"("name"[], "text", character[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_types_are"("name", "name"[], "text", character[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_types_are"("name", "name"[], "text", character[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_types_are"("name", "name"[], "text", character[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_types_are"("name", "name"[], "text", character[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_unalike"(boolean, "anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_unalike"(boolean, "anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_unalike"(boolean, "anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_unalike"(boolean, "anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_vol"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_vol"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."_vol"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_vol"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_vol"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."_vol"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."_vol"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_vol"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_result"(boolean, boolean, "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."add_result"(boolean, boolean, "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_result"(boolean, boolean, "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_result"(boolean, boolean, "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."adjust_for_sleep_time"("p_time" timestamp with time zone, "p_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."adjust_for_sleep_time"("p_time" timestamp with time zone, "p_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_for_sleep_time"("p_time" timestamp with time zone, "p_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."alarm_delete_trigger_func"() TO "anon";
GRANT ALL ON FUNCTION "public"."alarm_delete_trigger_func"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."alarm_delete_trigger_func"() TO "service_role";



GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."alike"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."any_column_privs_are"("name", "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."attach_into_book_or_library"("p_parent_id" bigint, "p_child_id" integer, "p_parent_type" "text", "p_position" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."attach_into_book_or_library"("p_parent_id" bigint, "p_child_id" integer, "p_parent_type" "text", "p_position" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."attach_into_book_or_library"("p_parent_id" bigint, "p_child_id" integer, "p_parent_type" "text", "p_position" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_eq"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_has"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_has"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_has"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_has"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_has"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_has"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_has"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_has"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_hasnt"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bag_ne"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_progressive_interval"("p_base_time" timestamp with time zone, "p_sent_count" integer, "p_now" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_progressive_interval"("p_base_time" timestamp with time zone, "p_sent_count" integer, "p_now" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_progressive_interval"("p_base_time" timestamp with time zone, "p_sent_count" integer, "p_now" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."can"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."can"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."can"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."can"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."can"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."can"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."can"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."can"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."can"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cast_context_is"("name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."casts_are"("text"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."casts_are"("text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."casts_are"("text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."casts_are"("text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."casts_are"("text"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."casts_are"("text"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."casts_are"("text"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."casts_are"("text"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_sort_position"("p_parent_type" "text", "p_parent_id" integer, "p_child_source_id" integer, "p_child_target_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."change_sort_position"("p_parent_type" "text", "p_parent_id" integer, "p_child_source_id" integer, "p_child_target_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_sort_position"("p_parent_type" "text", "p_parent_id" integer, "p_child_source_id" integer, "p_child_target_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_test"("text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_test"("text", boolean, "text", "text", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmp_ok"("anyelement", "text", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_default_is"("name", "name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_check"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_has_default"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_hasnt_default"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_fk"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_null"("table_name" "name", "column_name" "name", "description" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_null"("table_name" "name", "column_name" "name", "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_null"("table_name" "name", "column_name" "name", "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_null"("table_name" "name", "column_name" "name", "description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_pk"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_is_unique"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_fk"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_isnt_pk"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_not_null"("table_name" "name", "column_name" "name", "description" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_not_null"("table_name" "name", "column_name" "name", "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_not_null"("table_name" "name", "column_name" "name", "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_not_null"("table_name" "name", "column_name" "name", "description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_not_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_not_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_not_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_not_null"("schema_name" "name", "table_name" "name", "column_name" "name", "description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."col_type_is"("name", "name", "name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."collect_tap"(VARIADIC "text"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."collect_tap"(VARIADIC "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."collect_tap"(VARIADIC "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."collect_tap"(VARIADIC "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."collect_tap"(character varying[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."collect_tap"(character varying[]) TO "anon";
GRANT ALL ON FUNCTION "public"."collect_tap"(character varying[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."collect_tap"(character varying[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."column_privs_are"("name", "name", "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."columns_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."composite_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."database_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."db_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "text"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diag"(VARIADIC "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."diag"("msg" "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."diag"("msg" "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."diag"("msg" "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diag"("msg" "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."diag"("msg" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."diag"("msg" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."diag"("msg" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diag"("msg" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."diag_test_name"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."diag_test_name"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."diag_test_name"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."diag_test_name"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."display_oper"("name", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."display_oper"("name", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."display_oper"("name", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."display_oper"("name", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."do_tap"() TO "postgres";
GRANT ALL ON FUNCTION "public"."do_tap"() TO "anon";
GRANT ALL ON FUNCTION "public"."do_tap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."do_tap"() TO "service_role";



GRANT ALL ON FUNCTION "public"."do_tap"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."do_tap"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."do_tap"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."do_tap"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."do_tap"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."do_tap"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."do_tap"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."do_tap"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."do_tap"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."do_tap"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."do_tap"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."do_tap"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."doesnt_imatch"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."doesnt_match"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_is"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_is"("name", "text", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domain_type_isnt"("name", "text", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domains_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."domains_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."domains_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."domains_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."domains_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domains_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domains_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domains_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."domains_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enum_has_labels"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enums_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."enums_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."enums_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enums_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."enums_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."enums_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enums_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enums_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enums_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."extensions_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."extensions_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."extensions_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."extensions_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."extensions_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."extensions_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extensions_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extensions_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extensions_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fail"() TO "postgres";
GRANT ALL ON FUNCTION "public"."fail"() TO "anon";
GRANT ALL ON FUNCTION "public"."fail"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fail"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fail"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."fail"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."fail"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fail"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fdw_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."findfuncs"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."findfuncs"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."findfuncs"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."findfuncs"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."findfuncs"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."findfuncs"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."findfuncs"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."findfuncs"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."findfuncs"("name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."finish"("exception_on_failure" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."finish"("exception_on_failure" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."finish"("exception_on_failure" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."finish"("exception_on_failure" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name"[], "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name"[], "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fk_ok"("name", "name", "name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."folder_delete_trigger_func"() TO "anon";
GRANT ALL ON FUNCTION "public"."folder_delete_trigger_func"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."folder_delete_trigger_func"() TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_table_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."foreign_tables_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name"[], "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_lang_is"("name", "name", "name"[], "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name") TO "anon";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name"[], "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name") TO "anon";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_owner_is"("name", "name", "name"[], "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name"[], "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_privs_are"("name", "name", "name"[], "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name"[], "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_returns"("name", "name", "name"[], "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."functions_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."functions_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."functions_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."functions_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."functions_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."functions_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."functions_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."functions_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."functions_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dynamic_pages_chunk"("last_created_at" timestamp with time zone, "last_id" "text", "target_size" integer, "max_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dynamic_pages_chunk"("last_created_at" timestamp with time zone, "last_id" "text", "target_size" integer, "max_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dynamic_pages_chunk"("last_created_at" timestamp with time zone, "last_id" "text", "target_size" integer, "max_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_page_parents"("page_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_page_parents"("page_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_page_parents"("page_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."groups_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."groups_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."groups_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."groups_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."groups_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."groups_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."groups_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."groups_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_cast"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_cast"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_check"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_check"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_check"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_check"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_check"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_check"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_check"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_check"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_check"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_check"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_check"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_check"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_column"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_column"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_composite"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_composite"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_composite"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_composite"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_composite"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_composite"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_composite"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_composite"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_composite"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_composite"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_composite"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_composite"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_domain"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_domain"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_domain"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_domain"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_domain"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_domain"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_domain"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_domain"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_enum"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_enum"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_enum"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_enum"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_enum"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_enum"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_enum"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_enum"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_extension"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_extension"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_extension"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_extension"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_extension"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_extension"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_extension"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_extension"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_fk"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_fk"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_fk"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_fk"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_fk"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_fk"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_fk"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_fk"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_fk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_fk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_fk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_fk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_foreign_table"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_foreign_table"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_function"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_group"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_group"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_group"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_group"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_group"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_group"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_group"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_group"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_index"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_inherited_tables"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_language"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_language"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_language"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_language"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_language"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_language"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_language"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_language"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_leftop"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_materialized_view"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_materialized_view"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_opclass"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_opclass"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_opclass"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_opclass"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_opclass"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_opclass"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_operator"("name", "name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_pk"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_pk"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_pk"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_pk"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_pk"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_pk"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_pk"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_pk"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_pk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_pk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_pk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_pk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_relation"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_relation"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_relation"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_relation"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_relation"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_relation"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_relation"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_relation"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_relation"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_relation"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_relation"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_relation"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rightop"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_role"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_role"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rule"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_rule"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_schema"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_schema"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_schema"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_schema"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_schema"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_schema"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_schema"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_schema"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_sequence"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_sequence"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_sequence"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_sequence"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_sequence"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_sequence"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_table"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_table"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_table"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_table"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_table"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_table"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_table"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_table"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_table"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_table"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_table"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_table"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_table"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_table"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_table"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_table"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_tablespace"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_tablespace"("name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_trigger"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_type"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_type"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_type"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_type"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_type"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_type"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_type"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_type"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_type"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_type"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_type"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_type"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_type"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_type"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_type"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_type"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_unique"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_unique"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_unique"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_unique"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_unique"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_unique"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_unique"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_unique"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_unique"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_unique"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_unique"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_unique"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_user"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_user"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_user"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_user"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_user"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_user"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_user"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_user"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_view"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_view"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_view"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_view"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_view"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_view"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."has_view"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_view"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_view"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_view"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_view"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_view"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_view"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."has_view"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_view"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_view"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_cast"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_column"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_composite"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_composite"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_domain"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_domain"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_enum"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_enum"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_extension"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_extension"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_fk"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_fk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_foreign_table"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_function"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_group"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_group"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_group"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_group"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_group"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_group"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_group"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_group"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_index"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_inherited_tables"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_language"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_language"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_language"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_language"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_language"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_language"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_language"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_language"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_leftop"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_materialized_view"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_opclass"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_operator"("name", "name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_pk"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_pk"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_relation"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_relation"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rightop"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_role"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_role"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_role"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_role"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_role"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_role"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_role"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_role"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_rule"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_schema"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_schema"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_schema"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_schema"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_schema"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_schema"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_schema"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_schema"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_sequence"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_table"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_table"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_tablespace"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_trigger"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_type"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_type"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_user"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_user"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_user"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_user"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_user"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_user"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_user"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_user"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_view"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hasnt_view"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ialike"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."imatches"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."in_todo"() TO "postgres";
GRANT ALL ON FUNCTION "public"."in_todo"() TO "anon";
GRANT ALL ON FUNCTION "public"."in_todo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."in_todo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_primary"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_primary"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_type"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_unique"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_is_unique"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."index_owner_is"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."indexes_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is"("anyelement", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_aggregate"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ancestor_of"("name", "name", "name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_clustered"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_clustered"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_clustered"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_clustered"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_clustered"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_definer"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_descendent_of"("name", "name", "name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_empty"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_empty"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_empty"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_empty"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_empty"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_empty"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_empty"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_empty"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_indexed"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_normal_function"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partition_of"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partitioned"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partitioned"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_procedure"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_strict"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superuser"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_superuser"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_superuser"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superuser"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superuser"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_superuser"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_superuser"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superuser"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_window"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype") TO "postgres";
GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype") TO "anon";
GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype") TO "service_role";



GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isa_ok"("anyelement", "regtype", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt"("anyelement", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_aggregate"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_ancestor_of"("name", "name", "name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_definer"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_descendent_of"("name", "name", "name", "name", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_empty"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_empty"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_empty"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_empty"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_empty"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_empty"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_empty"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_empty"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_member_of"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_normal_function"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_partitioned"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_procedure"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_strict"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_superuser"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_superuser"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_superuser"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_superuser"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_superuser"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_superuser"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_superuser"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_superuser"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."isnt_window"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."language_is_trusted"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."language_is_trusted"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."language_is_trusted"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."language_is_trusted"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."language_is_trusted"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."language_is_trusted"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."language_is_trusted"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."language_is_trusted"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."language_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."language_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."languages_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."languages_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."languages_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."languages_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."languages_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."languages_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."languages_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."languages_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lives_ok"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lives_ok"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."lives_ok"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lives_ok"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lives_ok"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lives_ok"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lives_ok"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lives_ok"("text", "text") TO "service_role";















GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."matches"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_view_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."materialized_views_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."no_plan"() TO "postgres";
GRANT ALL ON FUNCTION "public"."no_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."no_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."no_plan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."num_failed"() TO "postgres";
GRANT ALL ON FUNCTION "public"."num_failed"() TO "anon";
GRANT ALL ON FUNCTION "public"."num_failed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."num_failed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ok"(boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."ok"(boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."ok"(boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ok"(boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."ok"(boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."ok"(boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ok"(boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ok"(boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclass_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."opclasses_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."operators_are"("text"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."operators_are"("text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."operators_are"("text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."operators_are"("text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."operators_are"("text"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."operators_are"("text"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."operators_are"("text"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."operators_are"("text"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."operators_are"("name", "text"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."os_name"() TO "postgres";
GRANT ALL ON FUNCTION "public"."os_name"() TO "anon";
GRANT ALL ON FUNCTION "public"."os_name"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."os_name"() TO "service_role";



GRANT ALL ON FUNCTION "public"."page_delete_trigger_func"() TO "anon";
GRANT ALL ON FUNCTION "public"."page_delete_trigger_func"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."page_delete_trigger_func"() TO "service_role";



GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."partitions_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pass"() TO "postgres";
GRANT ALL ON FUNCTION "public"."pass"() TO "anon";
GRANT ALL ON FUNCTION "public"."pass"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pass"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pass"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pass"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."pass"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pass"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric) TO "postgres";
GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."performs_ok"("text", numeric, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric) TO "postgres";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."performs_within"("text", numeric, numeric, integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."pg_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."pg_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pg_version_num"() TO "postgres";
GRANT ALL ON FUNCTION "public"."pg_version_num"() TO "anon";
GRANT ALL ON FUNCTION "public"."pg_version_num"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_version_num"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pgtap_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."pgtap_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."pgtap_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgtap_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."plan"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."plan"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."plan"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policies_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_cmd_is"("name", "name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."policy_roles_are"("name", "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_alarms_atomically"("p_current_time" timestamp with time zone, "p_batch_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_alarms_atomically"("p_current_time" timestamp with time zone, "p_batch_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_alarms_atomically"("p_current_time" timestamp with time zone, "p_batch_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."relation_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "refcursor", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("refcursor", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "refcursor", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_eq"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_eq"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "refcursor", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("refcursor", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "refcursor", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."results_ne"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."results_ne"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."roles_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."roles_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."roles_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."roles_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."roles_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."roles_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."roles_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."roles_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."row_eq"("text", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_instead"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_is_on"("name", "name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rules_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."runtests"() TO "postgres";
GRANT ALL ON FUNCTION "public"."runtests"() TO "anon";
GRANT ALL ON FUNCTION "public"."runtests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."runtests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."runtests"("name") TO "postgres";
GRANT ALL ON FUNCTION "public"."runtests"("name") TO "anon";
GRANT ALL ON FUNCTION "public"."runtests"("name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."runtests"("name") TO "service_role";



GRANT ALL ON FUNCTION "public"."runtests"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."runtests"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."runtests"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."runtests"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."runtests"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."runtests"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."runtests"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."runtests"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schema_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schema_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."schemas_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."schemas_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."schemas_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."schemas_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."schemas_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."schemas_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."schemas_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schemas_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_page"("keyword" "text", "additional_condition" "text", "order_by" "text", "limit_result" integer, "offset_result" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_page"("keyword" "text", "additional_condition" "text", "order_by" "text", "limit_result" integer, "offset_result" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_page"("keyword" "text", "additional_condition" "text", "order_by" "text", "limit_result" integer, "offset_result" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequence_privs_are"("name", "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sequences_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sequences_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sequences_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequences_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sequences_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequences_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sequences_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequences_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sequences_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."server_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_created_month"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_created_month"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_created_month"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_eq"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_eq"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_eq"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_has"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_has"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_has"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_has"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_has"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_has"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_has"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_has"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_hasnt"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray") TO "anon";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ne"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "anyarray", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ne"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ne"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_quota"("p_user_id" "uuid", "p_api_type_id" integer, "p_usage_amount" numeric, "p_free_plan_limit" numeric, "p_subscription_plan_limit" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."set_quota"("p_user_id" "uuid", "p_api_type_id" integer, "p_usage_amount" numeric, "p_free_plan_limit" numeric, "p_subscription_plan_limit" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_quota"("p_user_id" "uuid", "p_api_type_id" integer, "p_usage_amount" numeric, "p_free_plan_limit" numeric, "p_subscription_plan_limit" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."skip"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."skip"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."skip"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."skip"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."skip"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."skip"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."skip"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."skip"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."skip"(integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."skip"(integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."skip"(integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."skip"(integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."skip"("why" "text", "how_many" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."skip"("why" "text", "how_many" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."skip"("why" "text", "how_many" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."skip"("why" "text", "how_many" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_privs_are"("name", "name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tables_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."tables_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."tables_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tables_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."tables_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."tables_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tables_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tables_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tables_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tablespace_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tablespace_privs_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tablespaces_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ilike"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_imatching"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_like"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_like"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_like"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_like"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_like"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_like"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_like"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_like"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_matching"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ok"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ok"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ok"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ok"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ok"("text", character, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", character, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", character, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", character, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."throws_ok"("text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."todo"("how_many" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."todo"("how_many" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."todo"("how_many" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."todo"("how_many" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."todo"("why" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."todo"("why" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."todo"("why" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."todo"("why" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."todo"("how_many" integer, "why" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."todo"("how_many" integer, "why" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."todo"("how_many" integer, "why" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."todo"("how_many" integer, "why" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."todo"("why" "text", "how_many" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."todo"("why" "text", "how_many" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."todo"("why" "text", "how_many" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."todo"("why" "text", "how_many" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."todo_end"() TO "postgres";
GRANT ALL ON FUNCTION "public"."todo_end"() TO "anon";
GRANT ALL ON FUNCTION "public"."todo_end"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."todo_end"() TO "service_role";



GRANT ALL ON FUNCTION "public"."todo_start"() TO "postgres";
GRANT ALL ON FUNCTION "public"."todo_start"() TO "anon";
GRANT ALL ON FUNCTION "public"."todo_start"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."todo_start"() TO "service_role";



GRANT ALL ON FUNCTION "public"."todo_start"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."todo_start"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."todo_start"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."todo_start"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_is"("name", "name", "name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."triggers_are"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."type_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."types_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."types_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."types_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."types_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."types_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."types_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."types_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."types_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."types_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unalike"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unialike"("anyelement", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_alarm_updated_at_except_processed_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_alarm_updated_at_except_processed_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_alarm_updated_at_except_processed_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_book_child_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_book_child_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_book_child_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_book_parent_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_book_parent_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_book_parent_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_consent_times"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_consent_times"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_consent_times"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_folder_page_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_folder_page_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_folder_page_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_viewed_at"("page_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_viewed_at"("page_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_viewed_at"("page_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_library_child_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_library_child_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_library_child_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_ids_batch"("p_notification_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_ids_batch"("p_notification_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_ids_batch"("p_notification_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_page_parent_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_page_parent_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_page_parent_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_registered_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_registered_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_registered_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."users_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."users_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."users_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."users_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."users_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."users_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."users_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."users_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name") TO "postgres";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name") TO "anon";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name") TO "authenticated";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name") TO "service_role";



GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."view_owner_is"("name", "name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."views_are"("name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."views_are"("name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."views_are"("name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."views_are"("name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."views_are"("name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."views_are"("name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."views_are"("name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."views_are"("name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."views_are"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name"[], "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."volatility_is"("name", "name", "name"[], "text", "text") TO "service_role";






























GRANT ALL ON TABLE "public"."alarm" TO "anon";
GRANT ALL ON TABLE "public"."alarm" TO "authenticated";
GRANT ALL ON TABLE "public"."alarm" TO "service_role";



GRANT ALL ON TABLE "public"."alarm_deleted" TO "anon";
GRANT ALL ON TABLE "public"."alarm_deleted" TO "authenticated";
GRANT ALL ON TABLE "public"."alarm_deleted" TO "service_role";



GRANT ALL ON TABLE "public"."api_type" TO "anon";
GRANT ALL ON TABLE "public"."api_type" TO "authenticated";
GRANT ALL ON TABLE "public"."api_type" TO "service_role";



GRANT ALL ON TABLE "public"."api_usage_purpose" TO "anon";
GRANT ALL ON TABLE "public"."api_usage_purpose" TO "authenticated";
GRANT ALL ON TABLE "public"."api_usage_purpose" TO "service_role";



GRANT ALL ON TABLE "public"."api_vendors" TO "anon";
GRANT ALL ON TABLE "public"."api_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."api_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."beta_tester" TO "anon";
GRANT ALL ON TABLE "public"."beta_tester" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_tester" TO "service_role";



GRANT ALL ON SEQUENCE "public"."beta_tester_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."beta_tester_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."beta_tester_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."custom_prompts" TO "anon";
GRANT ALL ON TABLE "public"."custom_prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_prompts" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."documents_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."folder" TO "anon";
GRANT ALL ON TABLE "public"."folder" TO "authenticated";
GRANT ALL ON TABLE "public"."folder" TO "service_role";



GRANT ALL ON TABLE "public"."folder_deleted" TO "anon";
GRANT ALL ON TABLE "public"."folder_deleted" TO "authenticated";
GRANT ALL ON TABLE "public"."folder_deleted" TO "service_role";



GRANT ALL ON TABLE "public"."job_queue" TO "anon";
GRANT ALL ON TABLE "public"."job_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."job_queue" TO "service_role";



GRANT ALL ON TABLE "public"."page" TO "anon";
GRANT ALL ON TABLE "public"."page" TO "authenticated";
GRANT ALL ON TABLE "public"."page" TO "service_role";



GRANT ALL ON TABLE "public"."page_deleted" TO "anon";
GRANT ALL ON TABLE "public"."page_deleted" TO "authenticated";
GRANT ALL ON TABLE "public"."page_deleted" TO "service_role";



GRANT ALL ON TABLE "public"."product_payment_type_price" TO "anon";
GRANT ALL ON TABLE "public"."product_payment_type_price" TO "authenticated";
GRANT ALL ON TABLE "public"."product_payment_type_price" TO "service_role";



GRANT ALL ON SEQUENCE "public"."prouduct_payment_type_price_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."prouduct_payment_type_price_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."prouduct_payment_type_price_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."superuser" TO "anon";
GRANT ALL ON TABLE "public"."superuser" TO "authenticated";
GRANT ALL ON TABLE "public"."superuser" TO "service_role";



GRANT ALL ON TABLE "public"."user_info" TO "anon";
GRANT ALL ON TABLE "public"."user_info" TO "authenticated";
GRANT ALL ON TABLE "public"."user_info" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_info_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_info_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_info_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























