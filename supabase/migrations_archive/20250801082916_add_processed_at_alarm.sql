-- alarm 테이블에 processed_at 컬럼 추가
-- 이 컬럼은 알람 처리 중 동시성 제어를 위해 사용됩니다.
ALTER TABLE "public"."alarm"
ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone;

-- processed_at 컬럼에 대한 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS "idx_alarm_processing_simple" 
ON "public"."alarm" USING "btree" ("next_alarm_time", "processed_at");
