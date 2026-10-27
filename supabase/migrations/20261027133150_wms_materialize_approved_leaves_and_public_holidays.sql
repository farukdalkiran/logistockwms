-- Attendance is the canonical export ledger: store approved leaves AND official
-- holidays as synthetic, individually identifiable rows, never as physical scans.
CREATE SCHEMA IF NOT EXISTS wms_internal;
REVOKE ALL ON SCHEMA wms_internal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA wms_internal TO service_role;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS public_holiday_id uuid
  REFERENCES public.wms_public_holidays(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_public_holiday_employee_unique
  ON public.attendance(public_holiday_id,employee_id) WHERE public_holiday_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendance_public_holiday_lookup
  ON public.attendance(public_holiday_id) WHERE public_holiday_id IS NOT NULL;

CREATE OR REPLACE FUNCTION wms_internal.sync_public_holiday(p_holiday_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE h public.wms_public_holidays%ROWTYPE; written integer := 0;
BEGIN
  SELECT * INTO h FROM public.wms_public_holidays WHERE id=p_holiday_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  INSERT INTO public.attendance(
    employee_id,branch_id,public_holiday_id,check_in_time,check_out_time,
    rounded_check_in,rounded_check_out,working_hours,break_hours,status
  )
  SELECT e.id,e.branch_id,h.id,
    (h.holiday_date+h.start_time) AT TIME ZONE 'Asia/Istanbul',
    (h.holiday_date+h.end_time) AT TIME ZONE 'Asia/Istanbul',
    (h.holiday_date+h.start_time) AT TIME ZONE 'Asia/Istanbul',
    (h.holiday_date+h.end_time) AT TIME ZONE 'Asia/Istanbul',
    h.credited_hours,CASE WHEN h.period='FULL' THEN 1::numeric ELSE 0::numeric END,
    'LEAVE_RESMI_TATIL'
  FROM public.employees e
  WHERE e.is_active IS TRUE AND e.branch_id IS NOT NULL
  ON CONFLICT (public_holiday_id,employee_id) WHERE public_holiday_id IS NOT NULL
  DO UPDATE SET branch_id=EXCLUDED.branch_id,
    check_in_time=EXCLUDED.check_in_time,check_out_time=EXCLUDED.check_out_time,
    rounded_check_in=EXCLUDED.rounded_check_in,rounded_check_out=EXCLUDED.rounded_check_out,
    working_hours=EXCLUDED.working_hours,break_hours=EXCLUDED.break_hours,status=EXCLUDED.status;
  GET DIAGNOSTICS written=ROW_COUNT;
  RETURN written;
END $fn$;

CREATE OR REPLACE FUNCTION wms_internal.sync_approved_leave(p_leave_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  r public.leave_requests%ROWTYPE;
  dates_json jsonb; the_date date; in_clock time; out_clock time;
  in_ts timestamptz; out_ts timestamptz; payable numeric;
  old_id uuid; linked_id uuid; written integer := 0;
BEGIN
  SELECT * INTO r FROM public.leave_requests WHERE id=p_leave_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF r.status<>'APPROVED' THEN
    DELETE FROM public.attendance WHERE leave_request_id=r.id;
    RETURN 0;
  END IF;
  IF jsonb_typeof(r.selected_dates)='array' AND jsonb_array_length(r.selected_dates)>0 THEN
    dates_json:=r.selected_dates;
  ELSE
    SELECT coalesce(jsonb_agg(g.day::date::text),'[]'::jsonb) INTO dates_json
    FROM generate_series(r.start_date::timestamp,r.end_date::timestamp,'1 day') AS g(day);
  END IF;
  IF jsonb_array_length(dates_json)>366 THEN RAISE EXCEPTION 'Leave too long'; END IF;
  FOR the_date IN
    SELECT DISTINCT val::date FROM jsonb_array_elements_text(dates_json) AS t(val) ORDER BY 1
  LOOP
    in_clock:=CASE WHEN r.is_half_day AND r.half_day_period='AFTERNOON'
      THEN '13:00'::time ELSE '08:00'::time END;
    out_clock:=CASE WHEN r.is_half_day
      THEN CASE WHEN r.half_day_period='AFTERNOON'
        THEN '17:00'::time ELSE '12:00'::time END
      ELSE '17:00'::time END;
    in_ts:=(the_date+in_clock) AT TIME ZONE 'Asia/Istanbul';
    out_ts:=(the_date+out_clock) AT TIME ZONE 'Asia/Istanbul';
    payable:=CASE WHEN r.is_half_day THEN 4 ELSE 8 END;
    IF r.leave_type IN ('UCRETSIZ','ÜCRETSİZ','UCRETSIZ_IZIN') THEN payable:=0; END IF;

    SELECT a.id INTO linked_id FROM public.attendance a
      WHERE a.leave_request_id=r.id AND
        (a.check_in_time AT TIME ZONE 'Asia/Istanbul')::date=the_date LIMIT 1;
    IF linked_id IS NOT NULL THEN CONTINUE; END IF;

    -- Reuse historic LEAVE rows instead of duplicating previously paid hours.
    SELECT a.id INTO old_id FROM public.attendance a
      WHERE a.employee_id=r.employee_id AND a.status='LEAVE_'||r.leave_type
        AND a.leave_request_id IS NULL AND a.public_holiday_id IS NULL
        AND (a.check_in_time AT TIME ZONE 'Asia/Istanbul')::date=the_date
        AND (payable=0 OR abs(coalesce(a.working_hours,0)-payable)<0.1)
        AND (NOT r.is_half_day OR
          (a.check_in_time AT TIME ZONE 'Asia/Istanbul')::time=in_clock)
      ORDER BY a.created_at,a.id LIMIT 1;
    IF old_id IS NOT NULL THEN
      UPDATE public.attendance SET leave_request_id=r.id
        WHERE id=old_id AND leave_request_id IS NULL;
      written:=written+1;
    ELSE
      INSERT INTO public.attendance(
        employee_id,branch_id,leave_request_id,check_in_time,check_out_time,
        rounded_check_in,rounded_check_out,working_hours,break_hours,status
      ) VALUES(r.employee_id,r.branch_id,r.id,in_ts,out_ts,
        in_ts,out_ts,payable,CASE WHEN r.is_half_day THEN 0 ELSE 1 END,
        'LEAVE_'||r.leave_type)
      ON CONFLICT (leave_request_id,check_in_time)
        WHERE leave_request_id IS NOT NULL DO NOTHING;
      written:=written+1;
    END IF;
  END LOOP;
  RETURN written;
END $fn$;

CREATE OR REPLACE FUNCTION wms_internal.holiday_attendance_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
BEGIN
  PERFORM wms_internal.sync_public_holiday(NEW.id);
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_wms_holiday_attendance_sync ON public.wms_public_holidays;
CREATE TRIGGER trg_wms_holiday_attendance_sync
  AFTER INSERT OR UPDATE OF holiday_date,period,title ON public.wms_public_holidays
  FOR EACH ROW EXECUTE FUNCTION wms_internal.holiday_attendance_trigger();

CREATE OR REPLACE FUNCTION wms_internal.leave_attendance_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='APPROVED' AND (
    OLD.employee_id IS DISTINCT FROM NEW.employee_id OR
    OLD.branch_id IS DISTINCT FROM NEW.branch_id OR
    OLD.leave_type IS DISTINCT FROM NEW.leave_type OR
    OLD.selected_dates IS DISTINCT FROM NEW.selected_dates OR
    OLD.start_date IS DISTINCT FROM NEW.start_date OR
    OLD.end_date IS DISTINCT FROM NEW.end_date OR
    OLD.half_day_period IS DISTINCT FROM NEW.half_day_period OR
    OLD.is_half_day IS DISTINCT FROM NEW.is_half_day
  ) THEN
    DELETE FROM public.attendance WHERE leave_request_id=OLD.id;
  END IF;
  PERFORM wms_internal.sync_approved_leave(NEW.id);
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_wms_leave_attendance_sync ON public.leave_requests;
CREATE TRIGGER trg_wms_leave_attendance_sync
  AFTER INSERT OR UPDATE OF status,employee_id,branch_id,leave_type,
    selected_dates,start_date,end_date,is_half_day,half_day_period
  ON public.leave_requests FOR EACH ROW
  EXECUTE FUNCTION wms_internal.leave_attendance_trigger();

CREATE OR REPLACE FUNCTION wms_internal.future_holidays_for_employee()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
BEGIN
  IF NEW.is_active IS TRUE AND NEW.branch_id IS NOT NULL THEN
    INSERT INTO public.attendance(
      employee_id,branch_id,public_holiday_id,check_in_time,check_out_time,
      rounded_check_in,rounded_check_out,working_hours,break_hours,status
    )
    SELECT NEW.id,NEW.branch_id,h.id,
      (h.holiday_date+h.start_time) AT TIME ZONE 'Asia/Istanbul',
      (h.holiday_date+h.end_time) AT TIME ZONE 'Asia/Istanbul',
      (h.holiday_date+h.start_time) AT TIME ZONE 'Asia/Istanbul',
      (h.holiday_date+h.end_time) AT TIME ZONE 'Asia/Istanbul',
      h.credited_hours,CASE WHEN h.period='FULL' THEN 1::numeric ELSE 0::numeric END,
      'LEAVE_RESMI_TATIL'
    FROM public.wms_public_holidays h
    WHERE h.holiday_date >= (now() AT TIME ZONE 'Asia/Istanbul')::date
    ON CONFLICT (public_holiday_id,employee_id) WHERE public_holiday_id IS NOT NULL
    DO UPDATE SET branch_id=EXCLUDED.branch_id,
      check_in_time=EXCLUDED.check_in_time,check_out_time=EXCLUDED.check_out_time,
      rounded_check_in=EXCLUDED.rounded_check_in,rounded_check_out=EXCLUDED.rounded_check_out,
      working_hours=EXCLUDED.working_hours,break_hours=EXCLUDED.break_hours,status=EXCLUDED.status;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS trg_wms_employee_future_holidays ON public.employees;
CREATE TRIGGER trg_wms_employee_future_holidays
  AFTER INSERT OR UPDATE OF is_active,branch_id ON public.employees
  FOR EACH ROW EXECUTE FUNCTION wms_internal.future_holidays_for_employee();

-- No exposed RPC; only the trusted server can invoke reconciliation directly.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA wms_internal FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION wms_internal.sync_public_holiday(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION wms_internal.sync_approved_leave(uuid) TO service_role;

-- Historic backfill, once. All subsequent updates are write-driven.
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.leave_requests WHERE status='APPROVED' LOOP
    PERFORM wms_internal.sync_approved_leave(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public.wms_public_holidays LOOP
    PERFORM wms_internal.sync_public_holiday(r.id);
  END LOOP;
END $backfill$;
