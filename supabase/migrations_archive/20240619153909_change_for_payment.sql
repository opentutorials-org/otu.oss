


alter type "public"."order_status" rename to "order_status__old_version_to_be_dropped";

create type "public"."order_status" as enum ('SUCCESS', 'ON-HOLD', 'PENDING', 'FAILED', 'CANCEL', 'REFUND');



alter type "public"."subscription_active_status" rename to "subscription_active_status__old_version_to_be_dropped";

create type "public"."subscription_active_status" as enum ('ACTIVE_NORMAL', 'ACTIVE_PENDING_PAYMENT_RETRY', 'INACTIVE_EXPIRED_NO_AUTO_RENEWAL', 'INACTIVE_REFUNDED', 'INACTIVE_EXPIRED_CANCELLED', 'INACTIVE_EXPIRED_AUTO_RENEWAL_FAILED', 'INACTIVE_TERMINATED_DUE_TO_VIOLATION');

alter table "public"."order" alter column result_status type "public"."order_status" using result_status::text::"public"."order_status";

alter table "public"."subscriptions" alter column active_status type "public"."subscription_active_status" using active_status::text::"public"."subscription_active_status";


drop type "public"."order_status__old_version_to_be_dropped";


drop type "public"."subscription_active_status__old_version_to_be_dropped";

alter table "public"."order" add column "comment" text;

alter table "public"."order" add column "price" numeric;

alter table "public"."subscriptions" drop column "process_status";

alter table "public"."subscriptions" alter column "pg" drop not null;

drop type "public"."subscription_process_status";


