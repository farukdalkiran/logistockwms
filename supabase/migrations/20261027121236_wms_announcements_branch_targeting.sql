ALTER TABLE public.wms_announcements ADD COLUMN IF NOT EXISTS target_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS wms_announcements_target_branch_idx ON public.wms_announcements(target_branch_id,published_at DESC) WHERE is_active=true;
DROP POLICY IF EXISTS wms_announcement_read ON public.wms_announcements;
CREATE POLICY wms_announcement_read ON public.wms_announcements FOR SELECT TO authenticated
USING (
 EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer')
 OR (is_active AND published_at<=now() AND (target_branch_id IS NULL OR target_branch_id=(SELECT p.branch_id FROM public.profiles p WHERE p.id=(SELECT auth.uid()))))
);
DROP POLICY IF EXISTS wms_reads_insert ON public.wms_announcement_reads;
CREATE POLICY wms_reads_insert ON public.wms_announcement_reads FOR INSERT TO authenticated
WITH CHECK (
 user_id=(SELECT auth.uid())
 AND EXISTS (
  SELECT 1 FROM public.wms_announcements a
  WHERE a.id=announcement_id AND a.is_active AND a.published_at<=now()
  AND (a.target_branch_id IS NULL OR a.target_branch_id=(SELECT p.branch_id FROM public.profiles p WHERE p.id=(SELECT auth.uid())))
 )
);