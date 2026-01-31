ALTER TABLE usage
DROP COLUMN reset_date;

ALTER TABLE usage
RENAME COLUMN start_date TO subscription_start_date;

ALTER TABLE usage
RENAME COLUMN end_date TO subscription_end_date;