alter table user_info
alter column start_date
type numeric using start_date::numeric;