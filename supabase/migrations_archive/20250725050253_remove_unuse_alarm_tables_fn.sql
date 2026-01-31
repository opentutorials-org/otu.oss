-- ========================================
-- 사용하지 않는 알람 테이블 및 관련 객체 삭제
-- ========================================

-- 1. 관련 함수들 삭제 (테이블 삭제 시 자동으로 삭제되지 않음)
DROP FUNCTION IF EXISTS public.get_alarms(
    time with time zone,
    timestamp with time zone,
    integer
);

DROP FUNCTION IF EXISTS public.update_alarm_times_with_registrations(
    text[],
    timestamp with time zone
);

DROP FUNCTION IF EXISTS public.update_alarm_times(text[]);

-- 2. 외래키 제약조건을 고려한 테이블 삭제 순서
-- (alarm_times -> alarm_settings -> alarm_registrations)

-- 2-1. alarm_times 테이블 삭제 (alarm_settings를 참조하므로 먼저 삭제)
-- CASCADE로 다음 객체들이 자동 삭제됩니다:
-- - RLS 정책들 (4개)
-- - 인덱스들
-- - 제약조건들 (PRIMARY KEY, FOREIGN KEY)
-- - 권한들 (GRANT)
DROP TABLE IF EXISTS public.alarm_times CASCADE;

-- 2-2. alarm_settings 테이블 삭제
-- CASCADE로 다음 객체들이 자동 삭제됩니다:
-- - RLS 정책들 (4개)
-- - 인덱스들
-- - 제약조건들 (PRIMARY KEY, UNIQUE)
-- - 권한들 (GRANT)
DROP TABLE IF EXISTS public.alarm_settings CASCADE;

-- 2-3. alarm_registrations 테이블 삭제
-- CASCADE로 다음 객체들이 자동 삭제됩니다:
-- - RLS 정책들 (4개)
-- - 인덱스들
-- - 제약조건들 (PRIMARY KEY)
-- - 권한들 (GRANT)
DROP TABLE IF EXISTS public.alarm_registrations CASCADE;

-- ========================================
-- CASCADE로 자동 삭제되는 객체들:
-- ✅ RLS 정책들 (총 12개)
-- ✅ 인덱스들
-- ✅ PRIMARY KEY, FOREIGN KEY, UNIQUE 제약조건들
-- ✅ GRANT 권한들
-- ✅ 트리거들 (있다면)
--
-- ❌ 수동으로 삭제해야 하는 것들:
-- - 함수들 (위에서 이미 삭제함)
-- - database.types.ts 타입 정의들 (수동 제거함)
-- ========================================

-- ========================================
-- 주의사항:
-- 1. 이 마이그레이션을 실행하기 전에 해당 테이블들의 데이터를 백업하세요
-- 2. database.types.ts에서 해당 타입 정의들도 수동으로 제거했습니다
-- 3. 혹시 사용하는 코드가 있다면 오류가 발생할 수 있습니다
-- ======================================== 