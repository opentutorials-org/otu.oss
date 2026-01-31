alter table "public"."usage" alter column "last_reset_date" set data type timestamp with time zone using "last_reset_date"::timestamp with time zone;

alter table "public"."usage" alter column "next_reset_date" set data type timestamp with time zone using "next_reset_date"::timestamp with time zone;


