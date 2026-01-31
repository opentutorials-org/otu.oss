alter type "public"."payment_cycle" rename to "payment_cycle__old_version_to_be_dropped";

create type "public"."payment_cycle" as enum ('none', 'day', 'week', 'month', 'year');

alter table "public"."product_payment_type" alter column payment_cycle type "public"."payment_cycle" using payment_cycle::text::"public"."payment_cycle";

drop type "public"."payment_cycle__old_version_to_be_dropped";

INSERT INTO public.product_payment_type (id, name, description, platform, payment_cycle)
VALUES (1, 'web monthly subscription', NULL, 'web', 'month');
INSERT INTO public.product_payment_type (id, name, description, platform, payment_cycle)
VALUES (2, 'web yearly subscription', NULL, 'web', 'year');

INSERT INTO public.product_payment_type (id, name, description, platform, payment_cycle)
VALUES (3, 'ios monthly subscription', NULL, 'ios', 'month');
INSERT INTO public.product_payment_type (id, name, description, platform, payment_cycle)
VALUES (4, 'ios yearly subscription', NULL, 'ios', 'year');

INSERT INTO public.product_payment_type (id, name, description, platform, payment_cycle)
VALUES (5, 'android monthly subscription', NULL, 'android', 'month');
INSERT INTO public.product_payment_type (id, name, description, platform, payment_cycle)
VALUES (6, 'android yearly subscription', NULL, 'android', 'year');

ALTER TABLE public.prouduct_payment_type_price
ALTER COLUMN end_date DROP NOT NULL;

INSERT INTO public.prouduct_payment_type_price (id, product_payment_type_id, amount, currency, end_date)
VALUES (1, 1, 5, 'USD', NULL);

INSERT INTO public.prouduct_payment_type_price (id, product_payment_type_id, amount, currency, end_date)
VALUES (2, 2, 50, 'USD', NULL);

ALTER TABLE public.prouduct_payment_type_price
RENAME TO product_payment_type_price;
