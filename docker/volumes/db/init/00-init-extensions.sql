-- OTU 필수 PostgreSQL 확장
-- Supabase 셀프호스팅 시 초기 DB 설정

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;

-- pgroonga: 선택사항 (설치되지 않은 경우 무시)
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgroonga";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgroonga extension not available — skipping';
END $$;

-- Realtime 서비스용 스키마
CREATE SCHEMA IF NOT EXISTS _realtime;
