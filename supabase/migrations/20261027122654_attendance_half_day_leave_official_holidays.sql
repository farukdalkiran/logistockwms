ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS half_day_period text;
UPDATE public.leave_requests SET half_day_period='MORNING' WHERE is_half_day AND half_day_period IS NULL;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_half_day_period_valid
 CHECK ((is_half_day=false AND half_day_period IS NULL) OR (is_half_day=true AND half_day_period IN ('MORNING','AFTERNOON')));
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_leave_req_slot_unique ON public.attendance(leave_request_id,check_in_time) WHERE leave_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS attendance_employee_date_lookup ON public.attendance(employee_id,check_in_time);
CREATE INDEX IF NOT EXISTS leave_requests_approved_range_lookup ON public.leave_requests(employee_id,start_date,end_date) WHERE status='APPROVED';
CREATE TABLE IF NOT EXISTS public.wms_public_holidays (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 holiday_date date NOT NULL UNIQUE,
 title text NOT NULL CHECK(char_length(trim(title)) BETWEEN 3 AND 160),
 period text NOT NULL CHECK(period IN ('FULL','MORNING','AFTERNOON')),
 start_time time GENERATED ALWAYS AS (CASE period WHEN 'MORNING' THEN '08:00'::time WHEN 'AFTERNOON' THEN '13:00'::time ELSE '08:00'::time END) STORED,
 end_time time GENERATED ALWAYS AS (CASE period WHEN 'MORNING' THEN '12:00'::time WHEN 'AFTERNOON' THEN '17:00'::time ELSE '17:00'::time END) STORED,
 credited_hours numeric(4,2) GENERATED ALWAYS AS (CASE period WHEN 'FULL' THEN 8.00::numeric ELSE 4.00::numeric END) STORED,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wms_public_holidays_date_idx ON public.wms_public_holidays(holiday_date);
ALTER TABLE public.wms_public_holidays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wms_public_holidays FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wms_public_holidays TO authenticated;
CREATE POLICY wms_public_holidays_read ON public.wms_public_holidays FOR SELECT TO authenticated USING(true);
CREATE POLICY wms_public_holidays_insert ON public.wms_public_holidays FOR INSERT TO authenticated WITH CHECK(EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
CREATE POLICY wms_public_holidays_update ON public.wms_public_holidays FOR UPDATE TO authenticated USING(EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer')) WITH CHECK(EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
CREATE POLICY wms_public_holidays_delete ON public.wms_public_holidays FOR DELETE TO authenticated USING(EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
