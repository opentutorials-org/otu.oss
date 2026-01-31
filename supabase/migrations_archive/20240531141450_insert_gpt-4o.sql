INSERT INTO public.api_type (id, vendor_id, name, description, version, price, currency, created_at)
VALUES 
  (14, 2, 'gpt-4o-input', NULL, NULL, 0.0000005, 'USD', now()),
  (15, 2, 'gpt-4o-output', NULL, NULL, 0.0000015, 'USD', now())
ON CONFLICT (id) 
DO UPDATE SET
  vendor_id = EXCLUDED.vendor_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  created_at = EXCLUDED.created_at;


INSERT INTO public.api_type (id, vendor_id, name, description, version, price, currency, created_at)
VALUES 
  (16, 2, 'gpt-4o-vision-input-output', NULL, NULL, 0.000425, 'USD', now())
ON CONFLICT (id) 
DO UPDATE SET
  vendor_id = EXCLUDED.vendor_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  created_at = EXCLUDED.created_at;
