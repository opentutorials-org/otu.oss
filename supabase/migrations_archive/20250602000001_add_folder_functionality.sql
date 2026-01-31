-- 폴더 기능 추가
-- 페이지를 그룹핑하는 폴더 시스템 구현 (1:N 관계)

-- 폴더 테이블 생성
CREATE TABLE IF NOT EXISTS "public"."folder" (
    "id" "text" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "page_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_page_added_at" timestamp with time zone
);

ALTER TABLE "public"."folder" OWNER TO "postgres";

-- page 테이블에 폴더 관련 컬럼 추가
ALTER TABLE "public"."page" 
ADD COLUMN IF NOT EXISTS "folder_id" "text";

-- Primary Keys 추가
ALTER TABLE ONLY "public"."folder"
    ADD CONSTRAINT "folder_pkey" PRIMARY KEY ("id");

-- Foreign Keys 추가
ALTER TABLE ONLY "public"."folder"
    ADD CONSTRAINT "folder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."page"
    ADD CONSTRAINT "page_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE SET NULL;

-- 인덱스 생성
CREATE INDEX "folder_user_id_idx" ON "public"."folder" USING "btree" ("user_id");
CREATE INDEX "page_folder_id_idx" ON "public"."page" USING "btree" ("folder_id");

-- 폴더의 페이지 수를 자동으로 업데이트하는 트리거 함수
CREATE OR REPLACE FUNCTION "public"."update_folder_page_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- NEW.folder_id가 있는 경우 해당 폴더 업데이트
    IF NEW.folder_id IS NOT NULL THEN
      UPDATE "public"."folder" 
      SET page_count = (SELECT COUNT(*) FROM "public"."page" WHERE folder_id = NEW.folder_id),
          last_page_added_at = now()
      WHERE id = NEW.folder_id;
    END IF;
    
    -- UPDATE의 경우 이전 폴더도 업데이트 (folder_id가 변경된 경우)
    IF TG_OP = 'UPDATE' AND OLD.folder_id IS NOT NULL AND OLD.folder_id != NEW.folder_id THEN
      UPDATE "public"."folder" 
      SET page_count = (SELECT COUNT(*) FROM "public"."page" WHERE folder_id = OLD.folder_id)
      WHERE id = OLD.folder_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- OLD.folder_id가 있는 경우 해당 폴더 업데이트
    IF OLD.folder_id IS NOT NULL THEN
      UPDATE "public"."folder" 
      SET page_count = (SELECT COUNT(*) FROM "public"."page" WHERE folder_id = OLD.folder_id)
      WHERE id = OLD.folder_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION "public"."update_folder_page_count"() OWNER TO "postgres";



-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE TRIGGER "folder_updated_at_trigger" 
    BEFORE UPDATE ON "public"."folder" 
    FOR EACH ROW 
    EXECUTE FUNCTION "public"."update_updated_at_column"();

-- 폴더 페이지 수 업데이트 트리거 (page 테이블에 설정)
CREATE OR REPLACE TRIGGER "page_folder_count_trigger"
    AFTER INSERT OR UPDATE OR DELETE ON "public"."page"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_folder_page_count"();

-- RLS 활성화
ALTER TABLE "public"."folder" ENABLE ROW LEVEL SECURITY;

-- 폴더 테이블 RLS 정책
CREATE POLICY "Users can select their own folders" ON "public"."folder" 
    FOR SELECT TO "authenticated" 
    USING (( SELECT "auth"."uid"() AS "uid") = "user_id");

CREATE POLICY "Users can insert their own folders" ON "public"."folder" 
    FOR INSERT TO "authenticated" 
    WITH CHECK (( SELECT "auth"."uid"() AS "uid") = "user_id");

CREATE POLICY "Users can update their own folders" ON "public"."folder" 
    FOR UPDATE TO "authenticated" 
    USING (( SELECT "auth"."uid"() AS "uid") = "user_id") 
    WITH CHECK (( SELECT "auth"."uid"() AS "uid") = "user_id");

CREATE POLICY "Users can delete their own folders" ON "public"."folder" 
    FOR DELETE TO "authenticated" 
    USING (( SELECT "auth"."uid"() AS "uid") = "user_id");

-- 권한 부여
GRANT ALL ON TABLE "public"."folder" TO "anon";
GRANT ALL ON TABLE "public"."folder" TO "authenticated";
GRANT ALL ON TABLE "public"."folder" TO "service_role";

GRANT ALL ON FUNCTION "public"."update_folder_page_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_folder_page_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_folder_page_count"() TO "service_role";

-- 코멘트 추가
COMMENT ON TABLE "public"."folder" IS '페이지를 그룹핑하는 폴더 테이블';
COMMENT ON COLUMN "public"."folder"."id" IS '폴더 고유 식별자 (ULID 형식)';
COMMENT ON COLUMN "public"."folder"."user_id" IS '폴더 소유자 사용자 ID';
COMMENT ON COLUMN "public"."folder"."name" IS '폴더명';
COMMENT ON COLUMN "public"."folder"."description" IS '폴더 설명 (선택적)';
COMMENT ON COLUMN "public"."folder"."thumbnail_url" IS '폴더 썸네일 이미지 URL (선택적)';
COMMENT ON COLUMN "public"."folder"."page_count" IS '폴더에 속한 페이지 수 (트리거로 자동 관리)';
COMMENT ON COLUMN "public"."folder"."created_at" IS '폴더 생성 시간';
COMMENT ON COLUMN "public"."folder"."updated_at" IS '폴더 정보 마지막 수정 시간';
COMMENT ON COLUMN "public"."folder"."last_page_added_at" IS '마지막으로 페이지가 추가된 시간';

COMMENT ON COLUMN "public"."page"."folder_id" IS '페이지가 속한 폴더 ID (선택적, folder 테이블 참조)';

COMMENT ON FUNCTION "public"."update_folder_page_count"() IS '폴더의 페이지 수를 자동으로 업데이트하는 트리거 함수'; 