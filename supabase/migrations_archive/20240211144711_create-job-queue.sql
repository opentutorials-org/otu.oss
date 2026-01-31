create table "public"."job_queue" (
    "id" uuid not null default gen_random_uuid(),
    "job_name" text,
    "created_at" timestamp with time zone default (now() AT TIME ZONE 'utc'::text),
    "scheduled_time" timestamp with time zone not null default (now() AT TIME ZONE 'utc'::text),
    "payload" text,
    "user_id" uuid not null default auth.uid()
);


alter table "public"."job_queue" enable row level security;

CREATE UNIQUE INDEX job_queue_pk ON public.job_queue USING btree (id);

alter table "public"."job_queue" add constraint "job_queue_pk" PRIMARY KEY using index "job_queue_pk";

grant delete on table "public"."job_queue" to "anon";

grant insert on table "public"."job_queue" to "anon";

grant references on table "public"."job_queue" to "anon";

grant select on table "public"."job_queue" to "anon";

grant trigger on table "public"."job_queue" to "anon";

grant truncate on table "public"."job_queue" to "anon";

grant update on table "public"."job_queue" to "anon";

grant delete on table "public"."job_queue" to "authenticated";

grant insert on table "public"."job_queue" to "authenticated";

grant references on table "public"."job_queue" to "authenticated";

grant select on table "public"."job_queue" to "authenticated";

grant trigger on table "public"."job_queue" to "authenticated";

grant truncate on table "public"."job_queue" to "authenticated";

grant update on table "public"."job_queue" to "authenticated";

grant delete on table "public"."job_queue" to "service_role";

grant insert on table "public"."job_queue" to "service_role";

grant references on table "public"."job_queue" to "service_role";

grant select on table "public"."job_queue" to "service_role";

grant trigger on table "public"."job_queue" to "service_role";

grant truncate on table "public"."job_queue" to "service_role";

grant update on table "public"."job_queue" to "service_role";

create policy "Enable insert for users based on user_id"
on "public"."job_queue"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Enable read access for all users"
on "public"."job_queue"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Enable update for users based on email"
on "public"."job_queue"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



