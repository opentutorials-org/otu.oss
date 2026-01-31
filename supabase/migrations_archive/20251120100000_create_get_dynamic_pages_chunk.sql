-- pgTAP 확장 확인 및 활성화
CREATE EXTENSION IF NOT EXISTS pgtap;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 복합 인덱스 추가: (user_id, created_at, id)
-- 이 인덱스는 get_dynamic_pages_chunk 함수의 페이징 쿼리 성능을 최적화합니다.
CREATE INDEX IF NOT EXISTS page_user_id_created_at_id_idx 
ON public.page (user_id, created_at, id);

-- 동적 크기 페이지네이션을 위한 함수
-- 사용자의 페이지 데이터를 가져오되, 누적 데이터 크기가 target_size를 넘지 않도록(혹은 넘는 순간 멈추도록) 합니다.
-- target_size: 문자 수 기준 (제목+본문 합계), 제목과 본문 각각 최대 350,000자이므로 기본값은 700,000자
-- page.length는 title.length + body.length로 저장된 문자 수
-- body는 원본 HTML 문자열(태그 포함)의 길이를 사용하여 동기화 시 실제 전송되는 데이터 크기를 반영
-- 반환값: { "pages": [page_row, ...], "hasMore": boolean } 형태의 JSON
-- 
-- 최적화: Row Value Constructor (created_at, id) > (last_created_at, last_id) 문법을 사용하여
-- 복합 인덱스 (user_id, created_at, id)를 더 효율적으로 활용하도록 개선합니다.
CREATE OR REPLACE FUNCTION public.get_dynamic_pages_chunk(
  last_created_at timestamp with time zone,
  last_id text,
  target_size integer DEFAULT 700000, -- 기본 700,000자 (문자 수 기준, 제목+본문 최대값)
  max_limit integer DEFAULT 50         -- 기본 50개
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
