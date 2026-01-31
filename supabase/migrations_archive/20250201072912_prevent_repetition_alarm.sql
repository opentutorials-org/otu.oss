CREATE TABLE public.alarm_registrations (
  user_id uuid PRIMARY KEY,
  cap_time timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
) TABLESPACE pg_default;


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
        AND NOT EXISTS (
            SELECT 1 FROM alarm_registrations AR
            WHERE AR.user_id = A.user_id
              AND AR.cap_time = next_alarm_time_cap
        )
    LIMIT fetch_limit;
END;
$function$;



CREATE OR REPLACE FUNCTION public.update_alarm_times_with_registrations(
    alarmids text[],
    cap_time timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- alarm 테이블 업데이트: 다음 알람 시간을 계산하고, interval_days를 2배로 증가시킴
    UPDATE alarm
    SET next_alarm_time = next_alarm_time + (interval_days * INTERVAL '1 day'),
        interval_days = interval_days * 2
    WHERE page_id = ANY(alarmids);

    -- 업데이트된 alarm의 사용자들을 대상으로 alarm_registrations 테이블에 upsert 처리
    INSERT INTO alarm_registrations (user_id, cap_time, updated_at)
    SELECT DISTINCT user_id, cap_time, now()
    FROM alarm
    WHERE page_id = ANY(alarmids)
    ON CONFLICT (user_id)
    DO UPDATE SET cap_time = EXCLUDED.cap_time,
                  updated_at = now();
END;
$$;


DROP FUNCTION IF EXISTS public.update_alarm_times (TEXT[], TIMESTAMP WITH TIME ZONE);