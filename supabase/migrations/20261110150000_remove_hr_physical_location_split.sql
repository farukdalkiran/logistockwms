-- Retire the optional MD/AD/OO physical-location split without touching the
-- original employee.branch_id or existing role authorization.
-- A guard prevents discarding data if any punched entry acquired a location.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attendance'
      AND column_name = 'check_in_location_code'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.attendance WHERE check_in_location_code IS NOT NULL) THEN
      RAISE EXCEPTION 'Physical check-in location codes exist; review before dropping the column.';
    END IF;
    ALTER TABLE public.attendance DROP COLUMN check_in_location_code;
  END IF;
END $$;
