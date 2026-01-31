create table "public"."custom_prompts" (
    "user_id" uuid not null default auth.uid(),
    "title_prompt" text not null,
    "body_prompt" text not null,
    "photo_prompt" text not null,
    "ocr_prompt" text not null,
    "reminder_prompt" text not null,
    "extra_prompt" text,
    "extra_prompt_1" text,
    "extra_prompt_2" text,
    "extra_prompt_3" text,
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."custom_prompts" enable row level security;

CREATE UNIQUE INDEX custom_prompts_pkey ON public.custom_prompts USING btree (user_id);

alter table "public"."custom_prompts" add constraint "custom_prompts_pkey" PRIMARY KEY using index "custom_prompts_pkey";

alter table "public"."custom_prompts" add constraint "custom_prompts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."custom_prompts" validate constraint "custom_prompts_user_id_fkey";

grant delete on table "public"."custom_prompts" to "anon";

grant insert on table "public"."custom_prompts" to "anon";

grant references on table "public"."custom_prompts" to "anon";

grant select on table "public"."custom_prompts" to "anon";

grant trigger on table "public"."custom_prompts" to "anon";

grant truncate on table "public"."custom_prompts" to "anon";

grant update on table "public"."custom_prompts" to "anon";

grant delete on table "public"."custom_prompts" to "authenticated";

grant insert on table "public"."custom_prompts" to "authenticated";

grant references on table "public"."custom_prompts" to "authenticated";

grant select on table "public"."custom_prompts" to "authenticated";

grant trigger on table "public"."custom_prompts" to "authenticated";

grant truncate on table "public"."custom_prompts" to "authenticated";

grant update on table "public"."custom_prompts" to "authenticated";

grant delete on table "public"."custom_prompts" to "service_role";

grant insert on table "public"."custom_prompts" to "service_role";

grant references on table "public"."custom_prompts" to "service_role";

grant select on table "public"."custom_prompts" to "service_role";

grant trigger on table "public"."custom_prompts" to "service_role";

grant truncate on table "public"."custom_prompts" to "service_role";

grant update on table "public"."custom_prompts" to "service_role";

create policy "Enable insert for users based on user_id"
on "public"."custom_prompts"
as permissive
for insert
to public
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Enable update for users based on email"
on "public"."custom_prompts"
as permissive
for update
to public
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Enable users to view their own data only"
on "public"."custom_prompts"
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



