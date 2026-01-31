-- supabase/migrations/[timestamp]_create_folder_deleted_table.sql

-- 폴더 삭제 추적 테이블 생성
CREATE TABLE "public"."folder_deleted" (
    "id" text NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "user_id" uuid NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."folder_deleted" OWNER TO "postgres";

-- Primary Key 설정
CREATE UNIQUE INDEX folder_deleted_pkey ON public.folder_deleted USING btree (id);
ALTER TABLE "public"."folder_deleted" ADD CONSTRAINT "folder_deleted_pkey" PRIMARY KEY USING INDEX "folder_deleted_pkey";

-- RLS 활성화
ALTER TABLE "public"."folder_deleted" ENABLE ROW LEVEL SECURITY;

-- 폴더 삭제 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.folder_delete_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.folder_deleted(id, user_id)
  VALUES (OLD.id, OLD.user_id);
  RETURN OLD;
END;
$function$;

-- 폴더 삭제 시 자동으로 folder_deleted에 기록하는 트리거
CREATE TRIGGER folder_before_delete_trigger 
    BEFORE DELETE ON public.folder 
    FOR EACH ROW 
    EXECUTE FUNCTION folder_delete_trigger_func();

-- RLS 정책 생성
CREATE POLICY "Enable insert for users based on user_id"
ON "public"."folder_deleted"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Enable read for users based on user_id"
ON "public"."folder_deleted"
AS PERMISSIVE
FOR SELECT
TO public
USING ((auth.uid() = user_id));

CREATE POLICY "Enable delete for users based on user_id"
ON "public"."folder_deleted"
AS PERMISSIVE
FOR DELETE
TO public
USING ((auth.uid() = user_id));

-- 권한 부여 (page_deleted와 동일)
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."folder_deleted" TO "anon";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."folder_deleted" TO "authenticated";
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."folder_deleted" TO "service_role";