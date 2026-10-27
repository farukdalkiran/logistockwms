-- Already applied and tested on production (2026-10-27).
-- Public reads remain allowed to signed-in users for branch and role menus.
-- Cargo access is restricted by the actor profile branch.
-- Aras profiles remain server-only via service_role.
DROP POLICY IF EXISTS "Sadece Developer depo ekleyebilir/silebilir" ON public.branches;
DROP POLICY IF EXISTS "Yetkili herkes depoları okuyabilir" ON public.branches;
CREATE POLICY wms_branches_read ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY wms_branches_insert ON public.branches FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin')));
CREATE POLICY wms_branches_update ON public.branches FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin')));
CREATE POLICY wms_branches_delete ON public.branches FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin')));
CREATE POLICY wms_roles_read ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY wms_roles_insert ON public.roles FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin')));
CREATE POLICY wms_roles_update ON public.roles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin')));
CREATE POLICY wms_roles_delete ON public.roles FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('Developer','Admin')));
CREATE POLICY wms_cargo_sessions_read ON public.cargo_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND (p.role IN ('Developer','Admin') OR p.branch_id = public.cargo_sessions.branch_id)));
CREATE POLICY wms_cargo_sessions_insert ON public.cargo_sessions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND (p.role IN ('Developer','Admin') OR p.branch_id = public.cargo_sessions.branch_id)));
CREATE POLICY wms_cargo_sessions_update ON public.cargo_sessions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND (p.role IN ('Developer','Admin') OR p.branch_id = public.cargo_sessions.branch_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND (p.role IN ('Developer','Admin') OR p.branch_id = public.cargo_sessions.branch_id)));
CREATE POLICY wms_cargo_sessions_delete ON public.cargo_sessions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND (p.role IN ('Developer','Admin') OR p.branch_id = public.cargo_sessions.branch_id)));
CREATE POLICY wms_cargo_logs_read ON public.cargo_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.cargo_sessions s WHERE s.id = public.cargo_logs.session_id));
CREATE POLICY wms_cargo_logs_insert ON public.cargo_logs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.cargo_sessions s WHERE s.id = public.cargo_logs.session_id));
CREATE POLICY wms_cargo_logs_update ON public.cargo_logs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.cargo_sessions s WHERE s.id = public.cargo_logs.session_id)) WITH CHECK (EXISTS (SELECT 1 FROM public.cargo_sessions s WHERE s.id = public.cargo_logs.session_id));
CREATE POLICY wms_cargo_logs_delete ON public.cargo_logs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.cargo_sessions s WHERE s.id = public.cargo_logs.session_id));
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aras_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.branches,public.roles,public.cargo_sessions,public.cargo_logs,public.aras_files FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
