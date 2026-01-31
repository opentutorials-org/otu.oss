-- Step 1: id 컬럼 추가 (ULID 사용)
ALTER TABLE public.alarm ADD COLUMN id TEXT;

-- Step 2: 기존 데이터에 ID 생성 (page_id 기반 유도 가능)
UPDATE public.alarm 
SET id = 'alarm_' || encode(sha256(page_id::bytea), 'hex')::text
WHERE id IS NULL;

-- Step 3: id를 NOT NULL로 설정
ALTER TABLE public.alarm ALTER COLUMN id SET NOT NULL;

-- Step 4: 기존 PK 제거하고 새 PK 설정
ALTER TABLE public.alarm DROP CONSTRAINT alarm_pkey;
ALTER TABLE public.alarm ADD CONSTRAINT alarm_pkey PRIMARY KEY (id);

-- Step 5: page_id는 여전히 unique (하위 호환성 + 현재 비즈니스 로직 유지)
ALTER TABLE public.alarm ADD CONSTRAINT unique_page_alarm UNIQUE (page_id);

-- Step 6: 성능 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_alarm_page_id ON public.alarm (page_id);
CREATE INDEX IF NOT EXISTS idx_alarm_user_page ON public.alarm (user_id, page_id);
CREATE INDEX IF NOT EXISTS idx_alarm_processed_at ON public.alarm (processed_at); -- 동시성 제어용