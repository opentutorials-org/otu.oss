alter table "public"."documents" add column "user_id" uuid default auth.uid();

alter table "public"."documents" enable row level security;

alter table "public"."documents" add constraint "documents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id bigint, content text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$function$
;

create policy "Enable read access for all users"
on "public"."documents"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "delete_owned_data_only"
on "public"."documents"
as permissive
for delete
to authenticated
using ((auth.uid() = user_id));


create policy "insert_authenticated_users_only"
on "public"."documents"
as permissive
for insert
to authenticated
with check ((user_id = auth.uid()));



