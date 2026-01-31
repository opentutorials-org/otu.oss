-- Add unique constraint
ALTER TABLE "public"."alarm_settings" 
ADD CONSTRAINT "unique_user_alarm_settings" 
UNIQUE ("user_id");