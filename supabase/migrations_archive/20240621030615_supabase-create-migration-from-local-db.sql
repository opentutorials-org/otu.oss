alter table "public"."user_info" drop column "marketing_consent";

alter table "public"."user_info" add column "marketing_consent_update_at" timestamp with time zone;

alter table "public"."user_info" add column "marketing_consent_version" text;

alter table "public"."user_info" add column "privacy_policy_consent_updated_at" timestamp with time zone;

alter table "public"."user_info" add column "privacy_policy_consent_version" text;

alter table "public"."user_info" add column "terms_of_service_consent_update_at" timestamp with time zone;

alter table "public"."user_info" add column "terms_of_service_consent_version" text;


