alter type "public"."subscription_status" rename to "subscription_status__old_version_to_be_dropped";

create type "public"."subscription_status" as enum ('ACTIVE', 'INACTIVE_EXPIRED_AUTO_RENEW_FAIL', 'INACTIVE_FREE_USAGE_EXCEEDED', 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED');

alter table "public"."usage" alter column status type "public"."subscription_status" using status::text::"public"."subscription_status";

drop type "public"."subscription_status__old_version_to_be_dropped";


