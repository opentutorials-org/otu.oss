
create type "public"."subscription_process_status" as enum ('PENDING', 'FAILED', 'ON-HOLD');

alter table "public"."subscriptions" drop column "inactive_reason_status";

alter table "public"."subscriptions" add column "process_status" subscription_process_status not null default 'PENDING'::subscription_process_status;

drop type "public"."subscription_inactive_reason_status";


