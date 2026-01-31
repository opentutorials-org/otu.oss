-- alarm_debug_log 테이블 되돌리기
-- ============================================================================

-- 1. 인덱스 삭제
DROP INDEX IF EXISTS idx_alarm_debug_log_page_id;
DROP INDEX IF EXISTS idx_alarm_debug_log_created_at;

-- 2. 추가된 컬럼들 삭제
DO $$
BEGIN
    -- created_at 컬럼이 있다면 삭제
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alarm_debug_log' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE alarm_debug_log DROP COLUMN created_at;
    END IF;
    
    -- details 컬럼이 있다면 삭제
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alarm_debug_log' AND column_name = 'details'
    ) THEN
        ALTER TABLE alarm_debug_log DROP COLUMN details;
    END IF;
    
    -- log_type 컬럼이 있다면 삭제
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alarm_debug_log' AND column_name = 'log_type'
    ) THEN
        ALTER TABLE alarm_debug_log DROP COLUMN log_type;
    END IF;
END $$;

-- 3. 테이블 삭제 (주의: 모든 데이터가 삭제됩니다)
DROP TABLE IF EXISTS alarm_debug_log;