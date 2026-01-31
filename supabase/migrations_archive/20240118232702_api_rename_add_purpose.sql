DROP TRIGGER trigger_update_api_usage_statistics ON api_usage_raw;
DROP FUNCTION update_api_usage_statistics;

ALTER TABLE public.api_types
RENAME TO api_type;

ALTER TABLE public.api_usage_statistics
RENAME TO api_usage_statistic;

-- public.api_usage_raw 테이블 수정
ALTER TABLE public.api_usage_raw
    RENAME COLUMN unit TO amount;

ALTER TABLE public.api_usage_raw
    ALTER COLUMN amount TYPE numeric;

ALTER TABLE public.api_usage_statistic
    ALTER COLUMN api_sum TYPE numeric;

ALTER TABLE public.api_usage_raw
    ADD COLUMN created_month date;

ALTER TABLE public.api_usage_raw
    ADD COLUMN usage_purpose integer;

-- public.api_usage_purpose 테이블 생성
create table
  public.api_usage_purpose (
    id integer not null,
    name character varying(255) not null,
    description text null,
    created_at timestamp with time zone null default now(),
    constraint api_usage_purpose_pkey primary key (id)
  ) tablespace pg_default;

ALTER TABLE public.api_usage_purpose ENABLE ROW LEVEL SECURITY;

-- 외래키 설정
ALTER TABLE public.api_usage_raw
    ADD CONSTRAINT api_usage_raw_usage_purpose_fkey FOREIGN KEY (usage_purpose) REFERENCES public.api_usage_purpose (id);


CREATE OR REPLACE FUNCTION update_api_usage_statistic()
RETURNS TRIGGER AS $$
BEGIN
    -- 해당 월, 사용자, API 타입에 대한 행을 찾기
    PERFORM * FROM public.api_usage_statistic
    WHERE user_id = NEW.user_id
      AND api_type_id = NEW.api_type_id
      AND month = NEW.created_month;

    IF FOUND THEN
        -- 행이 존재하면 api_sum 업데이트
        UPDATE public.api_usage_statistic
        SET api_sum = api_sum + NEW.amount,
            updated_at = now()
        WHERE user_id = NEW.user_id
          AND api_type_id = NEW.api_type_id
          AND month = NEW.created_month;
    ELSE
        -- 행이 없으면 새로운 행 추가
        INSERT INTO public.api_usage_statistic (user_id, api_type_id, api_sum, month)
        VALUES (NEW.user_id, NEW.api_type_id, NEW.amount, NEW.created_month);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 트리거 생성
CREATE TRIGGER trigger_update_api_usage_statistic
AFTER INSERT ON public.api_usage_raw
FOR EACH ROW
EXECUTE FUNCTION update_api_usage_statistic();


INSERT INTO public.api_usage_purpose (id, name, description, created_at) 
VALUES 
(1, 'embedding for RAG', '', now()),
(2, 'LLM asking for RAG', '', now()),
(3, 'Image titling', '', now());