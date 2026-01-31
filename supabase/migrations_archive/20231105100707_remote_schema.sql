alter table "public"."documents" add column "page_id" integer;

alter table "public"."documents" alter column "embedding" set data type vector(1024) using "embedding"::vector(1024);

alter table "public"."documents" add constraint "documents_page_id_fkey" FOREIGN KEY (page_id) REFERENCES page(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_page_id_fkey";


