-- is_public 컬럼 추가
alter table "public"."documents" add column "is_public" boolean default false;

-- 기존 정책 삭제
drop policy if exists "Enable read access for all users" on "public"."documents";

-- 새로운 정책 생성
create policy "Enable read access for all users"
on "public"."documents"
as permissive
for select
to authenticated
using (((is_public = true) OR (user_id = (select auth.uid()))));
