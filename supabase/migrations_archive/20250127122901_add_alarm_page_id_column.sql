ALTER TABLE public.alarm
DROP COLUMN id;

ALTER TABLE public.alarm
ADD COLUMN page_id TEXT NOT NULL;

ALTER TABLE public.alarm
ADD CONSTRAINT alarm_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.page (id) ON DELETE CASCADE;

ALTER TABLE public.alarm
ADD CONSTRAINT alarm_pkey PRIMARY KEY (page_id);