create type "public"."subscription_active_status" as enum ('ACTIVE_NOMAL', 'ACTIVE_PENDING_PAYMENT_RETRY', 'INACTIVE_EXPIRED_NO_AUTO_RENEWAL', 'INACTIVE_REFUNDED', 'INACTIVE_EXPIRED_CANCELLED', 'INACTIVE_EXPIRED_AUTO_RENEWAL_FAILED', 'INACTIVE_TERMINATED_DUE_TO_VIOLATION');

create type "public"."subscription_inactive_reason_status" as enum ('NO_AUTO_RENEWAL', 'REFUNDED', 'CANCELLED');

alter table "public"."subscriptions" add column "active_status" subscription_active_status;

alter table "public"."subscriptions" add column "inactive_at" timestamp with time zone;

alter table "public"."subscriptions" add column "inactive_reason_status" subscription_inactive_reason_status;



