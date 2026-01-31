-- pgTAP을 사용한 get_dynamic_pages_chunk 함수 테스트
-- 실행 방법: 
--   1. pgTAP 확장 설치: CREATE EXTENSION IF NOT EXISTS pgtap;
--   2. psql -d postgres -f test/test_rpc_dynamic_chunk.pgtap.sql
--   3. 또는: docker exec -i supabase_db_new-opentutorials psql -U postgres -d postgres -f test/test_rpc_dynamic_chunk.pgtap.sql

BEGIN;

-- pgTAP 확장 확인 및 활성화
CREATE EXTENSION IF NOT EXISTS pgtap;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 기존 함수 삭제 (반환 타입이 변경되므로 DROP 필요)
DROP FUNCTION IF EXISTS public.get_dynamic_pages_chunk(timestamp with time zone, text, integer, integer);

-- 함수 재정의 (테스트 환경 구성)
CREATE FUNCTION public.get_dynamic_pages_chunk(
  last_created_at timestamp with time zone,
  last_id text,
  target_size integer DEFAULT 1048576,
  max_limit integer DEFAULT 50
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
      OR created_at > last_created_at 
      OR (created_at = last_created_at AND id > last_id)
    )
    ORDER BY created_at ASC, id ASC
    LIMIT max_limit + 1
  LOOP
    IF v_count >= max_limit THEN
      v_has_more := true;
      EXIT;
    END IF;

    v_current_size := v_current_size + COALESCE(v_row.length, LENGTH(COALESCE(v_row.body, '')), 0);
    v_pages := array_append(v_pages, v_row);
    v_count := v_count + 1;

    IF v_current_size >= target_size THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.page
        WHERE user_id = v_user_id
        AND (
          created_at > v_row.created_at 
          OR (created_at = v_row.created_at AND id > v_row.id)
        )
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

-- 테스트 계획 수 설정 (총 9개 테스트)
SELECT plan(9);

-- 테스트 사용자 설정
DO $$
DECLARE
    v_user_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- 세션 변수로 사용자 ID 설정
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);

    -- auth.users에 테스트 사용자 생성
    BEGIN
        INSERT INTO auth.users (id, email) VALUES (v_user_id, 'test@example.com');
    EXCEPTION WHEN OTHERS THEN
        -- 이미 존재하거나 권한 문제가 있어도 계속 진행
        NULL;
    END;
END $$;

-- 테스트 데이터 생성
DO $$
DECLARE
    v_user_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Case 1: 큰 페이지 3개 (A, B, C) - 각 400KB
    INSERT INTO public.page (id, title, body, user_id, created_at, length, type)
    VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        'Page A',
        repeat('A', 10),
        v_user_id,
        '2025-01-01 10:00:00+00',
        400 * 1024,
        'text'
    );

    INSERT INTO public.page (id, title, body, user_id, created_at, length, type)
    VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        'Page B',
        repeat('B', 10),
        v_user_id,
        '2025-01-01 10:00:01+00',
        400 * 1024,
        'text'
    );

    INSERT INTO public.page (id, title, body, user_id, created_at, length, type)
    VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
        'Page C',
        repeat('C', 10),
        v_user_id,
        '2025-01-01 10:00:02+00',
        400 * 1024,
        'text'
    );
    
    -- Case 2: 작은 페이지 5개 (D, E, F, G, H) - 각 1KB
    FOR i IN 4..8 LOOP
        INSERT INTO public.page (id, title, body, user_id, created_at, length, type)
        VALUES (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa' || i,
            'Page Small ' || i,
            'Small',
            v_user_id,
            ('2025-01-01 11:00:0' || i || '+00')::timestamp with time zone,
            1024,
            'text'
        );
    END LOOP;
END $$;

-- [TEST 1] 함수 존재 확인
SELECT has_function(
    'public',
    'get_dynamic_pages_chunk',
    ARRAY['timestamp with time zone', 'text', 'integer', 'integer'],
    '함수 get_dynamic_pages_chunk가 존재해야 함'
);

-- [TEST 2] 용량 제한 테스트 (Target Size = 1MB)
-- 함수 로직: 각 행을 반환하기 전 누적 크기를 체크합니다.
-- A(400KB) + B(400KB) = 800KB (ok)
-- C(400KB) 추가 시 1.2MB > 1MB 이지만, 현재 행 C는 포함하고 멈춤
-- 따라서 3개 페이지(A, B, C)가 반환됨
SELECT is(
    (SELECT json_array_length(get_dynamic_pages_chunk(
        NULL,
        NULL,
        1048576, -- 1MB
        100      -- 충분한 max_limit
    )->'pages')),
    3,
    '용량 제한 테스트: 1.2MB 데이터 조회 시 3개 페이지 반환'
);

-- [TEST 3] 용량 제한 시 hasMore 확인
-- A, B, C 이후에 D, E, F, G, H가 남아있으므로 hasMore는 true여야 함
SELECT is(
    (SELECT (get_dynamic_pages_chunk(
        NULL,
        NULL,
        1048576, -- 1MB
        100
    )->>'hasMore')::boolean),
    true,
    '용량 제한 테스트: 남은 데이터가 있으므로 hasMore는 true'
);

-- [TEST 4] 개수 제한 테스트 (Max Limit = 3)
-- A, B, C 3개 반환
SELECT is(
    (SELECT json_array_length(get_dynamic_pages_chunk(
        NULL,
        NULL,
        10485760, -- 10MB (충분한 크기)
        3         -- max_limit
    )->'pages')),
    3,
    '개수 제한 테스트: max_limit=3일 때 3개 페이지 반환'
);

-- [TEST 5] 개수 제한 시 hasMore 확인
-- A, B, C 이후 D...가 있으므로 hasMore는 true
SELECT is(
    (SELECT (get_dynamic_pages_chunk(
        NULL,
        NULL,
        10485760,
        3
    )->>'hasMore')::boolean),
    true,
    '개수 제한 테스트: 남은 데이터가 있으므로 hasMore는 true'
);

-- [TEST 6] 커서 연속성 테스트 - ID 확인
-- B 이후 조회 시 C만 반환되어야 함 (C의 ID: ...aaa3)
SELECT is(
    (SELECT (get_dynamic_pages_chunk(
        '2025-01-01 10:00:01+00', -- B's created_at
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', -- B's id
        1048576,
        100
    )->'pages'->0->>'id')),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '커서 연속성 테스트: 반환된 첫 번째 페이지 ID가 C(...aaa3)여야 함'
);

-- [TEST 7] 인증 실패 테스트
DO $$
DECLARE
    v_error_occurred boolean := false;
    v_error_message text;
BEGIN
    -- 인증 컨텍스트 제거
    PERFORM set_config('request.jwt.claim.sub', NULL, true);
    PERFORM set_config('request.jwt.claims', NULL, true);
    
    BEGIN
        PERFORM public.get_dynamic_pages_chunk(NULL, NULL, 1048576, 100);
    EXCEPTION WHEN OTHERS THEN
        v_error_message := SQLERRM;
        IF v_error_message LIKE '%Not authenticated%' THEN
            v_error_occurred := true;
        END IF;
    END;
    
    -- 인증 컨텍스트 복원
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000000')::text, true);
    
    IF NOT v_error_occurred THEN
        RAISE EXCEPTION '인증 실패 테스트 실패';
    END IF;
END $$;

SELECT ok(true, '인증 실패 시 Not authenticated 예외 발생');

-- [TEST 8] 빈 결과 테스트
SELECT is(
    (SELECT json_array_length(get_dynamic_pages_chunk(
        '2099-01-01 00:00:00+00',
        'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
        1048576,
        100
    )->'pages')),
    0,
    '빈 결과 테스트: 결과 배열 길이 0'
);

-- [TEST 9] 빈 결과 시 hasMore 확인
SELECT is(
    (SELECT (get_dynamic_pages_chunk(
        '2099-01-01 00:00:00+00',
        'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
        1048576,
        100
    )->>'hasMore')::boolean),
    false,
    '빈 결과 테스트: hasMore는 false'
);

-- 테스트 완료
SELECT finish();

ROLLBACK;
