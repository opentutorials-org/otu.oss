alter table "public"."order" drop column "book_payment_id";

alter table "public"."order" drop column "transaction_id";

alter table "public"."order" add column "parent_id" bigint;

alter table "public"."order" add column "psp_schedule_id" text;

alter table "public"."order" add column "psp_scheduled_at" timestamp with time zone;

alter table "public"."order" add column "psp_transaction_id" text;

alter table "public"."order" add constraint "order_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES "order"(id) not valid;

alter table "public"."order" validate constraint "order_parent_id_fkey";


