alter table public.documents
add constraint documents_page_id_fkey
foreign key (page_id) references public.page (id)
on delete cascade;
