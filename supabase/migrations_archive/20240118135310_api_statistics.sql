create table
  public.api_vendors (
    id integer not null,
    name character varying(50) not null,
    description text null,
    created_at timestamp with time zone null default now(),
    constraint api_vendors_pkey primary key (id)
  ) tablespace pg_default;

create table
  public.api_types (
    id integer not null,
    vendor_id integer null,
    name character varying(100) not null,
    description text null,
    version character varying(10) null,
    price numeric null,
    currency character varying(3) null,
    created_at timestamp with time zone null default now(),
    constraint api_types_pkey primary key (id),
    constraint api_types_vendor_id_fkey foreign key (vendor_id) references api_vendors (id)
  ) tablespace pg_default;

CREATE TABLE public.api_usage_raw (
  id integer GENERATED ALWAYS AS IDENTITY,
  user_id uuid null,
  api_type_id integer null,
  unit integer null,
  created_at timestamp with time zone null default now(),
  constraint api_usage_raw_pkey primary key (id),
  constraint api_usage_raw_api_type_id_fkey foreign key (api_type_id) references api_types (id),
  constraint api_usage_raw_user_id_fkey foreign key (user_id) references auth.users (id)
) tablespace pg_default;

CREATE TABLE public.api_usage_statistics (
  id integer GENERATED ALWAYS AS IDENTITY,
  user_id uuid null,
  api_type_id integer null,
  api_sum integer null,
  month date null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint api_usage_statistics_pkey primary key (id),
  constraint api_usage_statistics_api_type_id_fkey foreign key (api_type_id) references api_types (id),
  constraint api_usage_statistics_user_id_fkey foreign key (user_id) references auth.users (id)
) tablespace pg_default;

CREATE OR REPLACE FUNCTION update_api_usage_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- 해당 월, 사용자, API 타입에 대한 행을 찾기
    PERFORM * FROM public.api_usage_statistics
    WHERE user_id = NEW.user_id
      AND api_type_id = NEW.api_type_id
      AND month = date_trunc('month', NEW.created_at);

    IF FOUND THEN
        -- 행이 존재하면 api_sum 업데이트
        UPDATE public.api_usage_statistics
        SET api_sum = api_sum + NEW.unit,
            updated_at = now()
        WHERE user_id = NEW.user_id
          AND api_type_id = NEW.api_type_id
          AND month = date_trunc('month', NEW.created_at);
    ELSE
        -- 행이 없으면 새로운 행 추가
        INSERT INTO public.api_usage_statistics (user_id, api_type_id, api_sum, month)
        VALUES (NEW.user_id, NEW.api_type_id, NEW.unit, date_trunc('month', NEW.created_at));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 트리거 생성
CREATE TRIGGER trigger_update_api_usage_statistics
AFTER INSERT ON public.api_usage_raw
FOR EACH ROW
EXECUTE FUNCTION update_api_usage_statistics();


-- api_vendors 테이블에 대한 RLS 활성화
ALTER TABLE public.api_vendors ENABLE ROW LEVEL SECURITY;

-- api_types 테이블에 대한 RLS 활성화
ALTER TABLE public.api_types ENABLE ROW LEVEL SECURITY;

-- api_usage_raw 테이블에 대한 RLS 활성화
ALTER TABLE public.api_usage_raw ENABLE ROW LEVEL SECURITY;

-- api_usage_statistics 테이블에 대한 RLS 활성화
ALTER TABLE public.api_usage_statistics ENABLE ROW LEVEL SECURITY;


INSERT INTO "public"."api_vendors" ("id", "name", "description", "created_at") VALUES
	(1, 'openai', NULL, '2024-01-18 13:56:04.477471+00'),
	(2, 'cohere', NULL, '2024-01-18 13:56:15.277969+00');

INSERT INTO "public"."api_types" ("id", "vendor_id", "name", "description", "version", "price", "currency", "created_at") VALUES
	(1, 1, 'gpt-4-1106-preview-input', NULL, NULL, 0.00001, 'USD', '2024-01-18 13:57:44.345026+00'),
	(2, 1, 'gpt-4-1106-preview-output', NULL, NULL, 0.00003, 'USD', '2024-01-18 13:58:21.136226+00'),
	(3, 1, 'gpt-4-1106-vision-preview-input', NULL, NULL, 0.00001, NULL, '2024-01-18 13:59:00.044708+00'),
	(4, 1, 'gpt-4-1106-vision-preview-output', NULL, NULL, 0.00001, 'USD', '2024-01-18 13:59:38.188111+00'),
	(5, 2, 'embed-multilingual-v3.0', NULL, NULL, 0.0000001, 'USD', '2024-01-18 14:04:51.607137+00');

