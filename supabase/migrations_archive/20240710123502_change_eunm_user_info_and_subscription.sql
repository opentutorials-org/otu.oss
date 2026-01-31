alter table "public"."user_info" alter column "avaliable_status" drop default;

alter type "public"."node_type" rename to "node_type__old_version_to_be_dropped";

create type "public"."node_type" as enum ('LIBRARY', 'BOOK', 'PAGE');

alter type "public"."pg" rename to "pg__old_version_to_be_dropped";

create type "public"."pg" as enum ('PAYPAL', 'APPLE', 'GOOGLE', 'TOSS', 'NAVER');

alter type "public"."user_info_avaliable_status" rename to "user_info_avaliable_status__old_version_to_be_dropped";

create type "public"."user_info_avaliable_status" as enum ('ACTIVE', 'INACTIVE_FREE_USAGE_EXCEEDED', 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED', 'INACTIVE_PAYMENT_FAILED', 'INACTIVE_PAYMENT_PENDING', 'ACTIVE_BUT_PAYMENT_FAILED', 'ACITVE_BUT_NEXT_PAYMENT_FAILED');

alter table "public"."subscriptions" alter column pg type "public"."pg" using pg::text::"public"."pg";

alter table "public"."user_info" alter column avaliable_status type "public"."user_info_avaliable_status" using avaliable_status::text::"public"."user_info_avaliable_status";

alter table "public"."user_info" alter column "avaliable_status" set default 'ACTIVE'::user_info_avaliable_status;

drop type "public"."node_type__old_version_to_be_dropped";

drop type "public"."pg__old_version_to_be_dropped";

drop type "public"."user_info_avaliable_status__old_version_to_be_dropped";

alter table "public"."subscriptions" alter column "pg" set not null;