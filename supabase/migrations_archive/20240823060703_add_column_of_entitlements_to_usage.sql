alter table "public"."usage" drop column "subscription_end_date";

alter table "public"."usage" drop column "subscription_start_date";

alter table "public"."usage" add column "data" jsonb;

alter table "public"."usage" add column "premium_expires_date" timestamp with time zone;

alter table "public"."usage" add column "premium_grace_period_expires_date" timestamp with time zone;

alter table "public"."usage" add column "premium_product_identifier" text;

alter table "public"."usage" add column "premium_purchase_date" timestamp with time zone;


