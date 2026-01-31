drop policy "select_private_data" on "public"."book_page_mapping";

drop policy "select_public_data" on "public"."book_page_mapping";

drop policy "select_private_data" on "public"."library_book_mapping";

drop policy "select_public_data" on "public"."library_book_mapping";

alter table "public"."book_page_mapping" drop column "is_public";

alter table "public"."library_book_mapping" drop column "is_public";

create policy "select"
on "public"."book_page_mapping"
as permissive
for select
to public
using (true);


create policy "select_public_data"
on "public"."library_book_mapping"
as permissive
for select
to public
using (true);



