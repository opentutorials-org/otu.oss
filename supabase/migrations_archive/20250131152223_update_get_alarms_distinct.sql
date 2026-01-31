
CREATE OR REPLACE FUNCTION public.get_alarms(
    alarm_time_cap time with time zone, 
    next_alarm_time_cap timestamp with time zone, 
    fetch_limit integer
)
RETURNS TABLE(
    user_id uuid, 
    content text, 
    start_time timestamp with time zone, 
    interval_days integer, 
    next_alarm_time timestamp with time zone, 
    page_id text, 
    id text, 
    alarm_setting_id text, 
    alarm_time time with time zone, 
    created_at timestamp without time zone, 
    updated_at timestamp without time zone, 
    is_active boolean
) 
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (A.user_id)
        A.user_id,
        A.content,
        A.start_time,
        A.interval_days,
        A.next_alarm_time,
        A.page_id,
        AT.id,
        AT.alarm_setting_id,
        AT.alarm_time,
        AT.created_at,
        AT.updated_at,
        AT.is_active
    FROM alarm_times AS AT
    INNER JOIN alarm AS A
        ON AT.user_id = A.user_id
    WHERE
        (AT.alarm_time AT TIME ZONE 'UTC') = alarm_time_cap
        AND AT.is_active = true
        AND A.next_alarm_time < next_alarm_time_cap
    LIMIT fetch_limit;
END;
$function$;