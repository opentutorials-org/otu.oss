create type "public"."user_info_avaliable_status" as enum ('ACTIVE', 'INACTIVE_FREE_USAGE_EXCEEDED', 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED', 'INACTIVE_PAYMENT_FAILED');

alter table "public"."user_info" drop column "is_avaliable";

alter table "public"."user_info" add column "avaliable_status" user_info_avaliable_status not null default 'ACTIVE'::user_info_avaliable_status;


