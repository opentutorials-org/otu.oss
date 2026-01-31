create type "public"."job_status" as enum ('PENDING', 'RUNNING', 'FAIL');

alter table "public"."job_queue" add column "last_running_at" timestamp with time zone;

alter table "public"."job_queue" add column "status" job_status;


