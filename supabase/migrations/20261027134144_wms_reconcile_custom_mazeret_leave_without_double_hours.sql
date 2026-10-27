
-- Refine the pre-existing approved-leave sync to recognize the legacy
-- MAZERET status of custom DIGER / "Mazeret İzni" requests.
DO $patch$
DECLARE source_code text;
BEGIN
  SELECT pg_get_functiondef('wms_internal.sync_approved_leave(uuid)'::regprocedure)
    INTO source_code;
  IF position('AND a.status=''LEAVE_''||r.leave_type' IN source_code)=0 THEN
    RAISE EXCEPTION 'Unexpected approved-leave function definition';
  END IF;
  source_code:=replace(
    source_code,
    'AND a.status=''LEAVE_''||r.leave_type',
    'AND (a.status=''LEAVE_''||r.leave_type OR (r.leave_type=''DIGER'' AND lower(coalesce(r.custom_leave_type, '''')) LIKE ''%mazeret%'' AND a.status=''LEAVE_MAZERET''))'
  );
  EXECUTE source_code;
END $patch$;

-- Prefer the existing historic 8h synthetic row over a new duplicate, while
-- preserving its original clock time/status and real check-in/out records.
DO $repair$
DECLARE x record; repaired integer:=0;
BEGIN
  FOR x IN
    SELECT DISTINCT legacy.id historic_id, linked.id duplicate_id, l.id request_id
    FROM public.leave_requests l
    JOIN public.attendance linked ON linked.leave_request_id=l.id
      AND linked.status='LEAVE_DIGER' AND linked.public_holiday_id IS NULL
    JOIN public.attendance legacy ON legacy.employee_id=l.employee_id
      AND legacy.leave_request_id IS NULL AND legacy.public_holiday_id IS NULL
      AND legacy.status='LEAVE_MAZERET'
      AND (legacy.check_in_time AT TIME ZONE 'Asia/Istanbul')::date
        = (linked.check_in_time AT TIME ZONE 'Asia/Istanbul')::date
      AND abs(coalesce(legacy.working_hours,0)-coalesce(linked.working_hours,0))<0.1
    WHERE l.status='APPROVED' AND l.leave_type='DIGER'
      AND lower(coalesce(l.custom_leave_type,'')) LIKE '%mazeret%'
  LOOP
    DELETE FROM public.attendance
      WHERE id=x.duplicate_id AND leave_request_id=x.request_id AND status='LEAVE_DIGER';
    UPDATE public.attendance SET leave_request_id=x.request_id
      WHERE id=x.historic_id AND leave_request_id IS NULL AND status='LEAVE_MAZERET';
    repaired:=repaired+1;
  END LOOP;
  IF repaired>10 THEN RAISE EXCEPTION 'Unexpected historic leave collision count %',repaired; END IF;
END $repair$;
