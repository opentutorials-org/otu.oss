-- alarm 테이블에 updated_at, created_at 컬럼 추가
ALTER TABLE public.alarm 
ADD COLUMN created_at timestamp with time zone DEFAULT now() NOT NULL,
ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;

-- alarm 테이블에 updated_at 자동 갱신 트리거 적용
CREATE TRIGGER update_alarm_modified_time 
    BEFORE UPDATE ON public.alarm 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();