create table
  public.alarm (
    id text not null,
    user_id uuid not null default auth.uid (),
    content text not null,
    start_time timestamp with time zone not null,
    interval_days integer not null,
    next_alert_time timestamp with time zone not null,
    constraint alarm_pkey primary key (id),
    constraint alarm_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
  ) tablespace pg_default;


  create table
  public.alarm_settings (
    id text not null,
    user_id uuid not null default auth.uid (),
    is_active boolean not null default true,
    sound character varying(255) null default null::character varying,
    created_at timestamp without time zone null default now(),
    updated_at timestamp without time zone null default now(),
    constraint alarm_settings_pkey primary key (id),
    constraint alarm_settings_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
  ) tablespace pg_default;


  create table
  public.alarm_times (
    id text not null,
    alarm_setting_id text not null,
    user_id uuid not null default auth.uid (),
    alert_time time with time zone not null,
    created_at timestamp without time zone null default now(),
    updated_at timestamp without time zone null default now(),
    constraint alarm_times_pkey primary key (id),
    constraint fk_alarm_setting_id foreign key (alarm_setting_id) references alarm_settings (id) on delete cascade,
    constraint alarm_times_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
  ) tablespace pg_default;

alter table "public"."alarm" enable row level security;

alter table "public"."alarm_settings" enable row level security;

alter table "public"."alarm_times" enable row level security;


create policy "Authenticated users can delete their own alarms"
on "public"."alarm"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can insert their own alarms"
on "public"."alarm"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can select their own alarms"
on "public"."alarm"
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can update their own alarms"
on "public"."alarm"
as permissive
for update
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can delete their own alarm settings"
on "public"."alarm_settings"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can insert new alarm settings"
on "public"."alarm_settings"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can select their own alarm settings"
on "public"."alarm_settings"
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can update their own alarm settings"
on "public"."alarm_settings"
as permissive
for update
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can delete their own alarm times"
on "public"."alarm_times"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can insert their own alarm times"
on "public"."alarm_times"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can select their own alarm times"
on "public"."alarm_times"
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


create policy "Authenticated users can update their own alarm times"
on "public"."alarm_times"
as permissive
for update
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



