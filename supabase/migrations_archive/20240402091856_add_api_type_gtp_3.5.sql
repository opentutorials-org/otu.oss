INSERT INTO public.api_type (id, vendor_id, name, description, version, price, currency, created_at)
VALUES 
(12, 2, 'gpt-3.5-turbo-input', NULL, NULL, 0.0000005, 'USD', '2024-04-02 18:22:05.385949+00'),
(13, 2, 'gpt-3.5-turbo-output', NULL, NULL, 0.0000015, 'USD', '2024-04-02 18:22:05.385949+00');


UPDATE public.api_type SET currency = 'USD' WHERE id = 3;