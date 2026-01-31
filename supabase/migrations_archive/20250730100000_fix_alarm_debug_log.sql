-- alarm_debug_log 테이블 생성 및 수정
-- ============================================================================

-- 1. alarm_debug_log 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS alarm_debug_log (
    id SERIAL PRIMARY KEY,
    page_id TEXT NOT NULL,
    log_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_alarm_debug_log_page_id ON alarm_debug_log(page_id);
CREATE INDEX IF NOT EXISTS idx_alarm_debug_log_created_at ON alarm_debug_log(created_at);
-- 3. 기존 테이블에 누락된 컬럼 추가 (이미 존재한다면 무시)
DO $$
BEGIN
    -- log_type 컬럼이 없다면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alarm_debug_log' AND column_name = 'log_type'
    ) THEN
        ALTER TABLE alarm_debug_log ADD COLUMN log_type TEXT NOT NULL DEFAULT 'info';
    END IF;
    
    -- details 컬럼이 없다면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alarm_debug_log' AND column_name = 'details'
    ) THEN
        ALTER TABLE alarm_debug_log ADD COLUMN details JSONB;
    END IF;
    
    -- created_at 컬럼이 없다면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'alarm_debug_log' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE alarm_debug_log ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$