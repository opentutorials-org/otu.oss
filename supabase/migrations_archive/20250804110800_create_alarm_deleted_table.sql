-- Create alarm_deleted table for tracking deleted alarms in sync
-- This table helps maintain sync integrity by tracking which alarms were deleted

CREATE TABLE "public"."alarm_deleted" (
    "id" text NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "user_id" uuid NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."alarm_deleted" OWNER TO "postgres";

-- Primary Key 설정
CREATE UNIQUE INDEX alarm_deleted_pkey ON public.alarm_deleted USING btree (id);
ALTER TABLE "public"."alarm_deleted" ADD CONSTRAINT "alarm_deleted_pkey" PRIMARY KEY USING INDEX "alarm_deleted_pkey";

-- RLS 활성화
ALTER TABLE "public"."alarm_deleted" ENABLE ROW LEVEL SECURITY;

-- 알람 삭제 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.alarm_delete_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.alarm_deleted(id, user_id)
  VALUES (OLD.id, OLD.user_id);
  RETURN OLD;
END;
$function$;

-- 알람 삭제 시 자동으로 alarm_deleted에 기록하는 트리거
CREATE TRIGGER alarm_before_delete_trigger 
    BEFORE DELETE ON public.alarm 
    FOR EACH ROW 
    EXECUTE FUNCTION alarm_delete_trigger_func();

-- RLS 정책 생성
CREATE POLICY "Enable insert for users based on user_id"
ON "public"."alarm_deleted"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Enable read for users based on user_id"
ON "public"."alarm_deleted"
AS PERMISSIVE
FOR SELECT
TO public
USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Enable delete for users based on user_id"
ON "public"."alarm_deleted"
AS PERMISSIVE
FOR DELETE
TO public
USING ((( SELECT auth.uid() AS uid) = user_id));

-- 권한 부여 (folder_deleted와 동일)
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."alarm_deleted" TO "service_role";