-- Mobile detection is recorded only on IN. Editing/closing an attendance record
-- must never erase the original phone/desktop origin or the physical check-in site.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_device_type varchar(7)
  CONSTRAINT attendance_check_in_device_type_check
  CHECK (check_in_device_type IN ('PHONE','DESKTOP'));

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS is_system_adjusted boolean NOT NULL DEFAULT false;

-- Mark only historically identifiable system-made/edited records; do not guess
-- the device of older scans, and do not classify ordinary OUT as an edit.
UPDATE public.attendance
SET is_system_adjusted = true
WHERE is_system_adjusted = false
  AND status NOT LIKE 'LEAVE_%'
  AND (
    status LIKE 'MANUAL_EDIT_%'
    OR status = 'AUTO_CLOSED_MISSING_OUT'
    OR (manager_id IS NOT NULL AND status IN ('ON_TIME','PRESENT'))
  );

COMMENT ON COLUMN public.attendance.check_in_device_type IS
  'Browser-reported device category at IN (PHONE/DESKTOP), never changed by OUT; legacy null.';
COMMENT ON COLUMN public.attendance.is_system_adjusted IS
  'Set for HR system-created/edited, bulk completed, approved correction or auto-closed attendance. Not for ordinary OUT.';
