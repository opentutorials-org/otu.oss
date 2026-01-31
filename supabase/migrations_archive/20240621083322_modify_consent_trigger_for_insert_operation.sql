set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_consent_times()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- For marketing consent
  IF NEW.marketing_consent_version IS DISTINCT FROM OLD.marketing_consent_version OR TG_OP = 'INSERT' THEN
    NEW.marketing_consent_update_at = NOW();
  END IF;

  -- For privacy policy consent
  IF NEW.privacy_policy_consent_version IS DISTINCT FROM OLD.privacy_policy_consent_version OR TG_OP = 'INSERT' THEN
    NEW.privacy_policy_consent_updated_at = NOW();
  END IF;

  -- For terms of service consent
  IF NEW.terms_of_service_consent_version IS DISTINCT FROM OLD.terms_of_service_consent_version OR TG_OP = 'INSERT' THEN
    NEW.terms_of_service_consent_update_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE TRIGGER update_consent_times_trigger_insert BEFORE INSERT ON public.user_info FOR EACH ROW EXECUTE FUNCTION update_consent_times();

CREATE TRIGGER update_consent_times_trigger_update BEFORE UPDATE ON public.user_info FOR EACH ROW EXECUTE FUNCTION update_consent_times();


