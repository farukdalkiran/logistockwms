-- Retire only the optional device / system-origin display metadata.
-- Apply after the matching production code is ready to avoid old deployments
-- querying columns which no longer exist. Attendance and transaction logs stay.
ALTER TABLE public.attendance
  DROP COLUMN IF EXISTS check_in_device_type,
  DROP COLUMN IF EXISTS is_system_adjusted;
