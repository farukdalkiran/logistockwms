-- Physical check-in location is separate from the shared Online Depo account branch.
-- Nullable: existing punches and leave credits must not be relabeled.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_location_code varchar(2)
  CONSTRAINT attendance_check_in_location_code_check
  CHECK (check_in_location_code IN ('MD', 'AD', 'OO'));

COMMENT ON COLUMN public.attendance.check_in_location_code IS
  'Only the physical terminal location of a real IN punch. Independent from employee branch_id; remains unchanged on OUT. Null for legacy and leave rows.';
