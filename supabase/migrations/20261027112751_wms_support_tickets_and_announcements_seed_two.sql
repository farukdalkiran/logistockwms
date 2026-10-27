-- Already applied on Supabase production. This file mirrors the applied migration.

-- Dedicated operational announcements and support tickets. No timers or triggers.
CREATE TABLE IF NOT EXISTS public.wms_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name text NOT NULL DEFAULT '',
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'GENERAL' CHECK (category IN ('GENERAL','TECHNICAL','ORDERS','STOCK','ATTENDANCE','TRANSFER','CARGO')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 140),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED')),
  developer_note text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wms_support_tickets_creator_idx ON public.wms_support_tickets(created_by,created_at DESC);
CREATE INDEX IF NOT EXISTS wms_support_tickets_open_idx ON public.wms_support_tickets(created_at DESC) WHERE status <> 'COMPLETED';

CREATE TABLE IF NOT EXISTS public.wms_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_key text UNIQUE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 150),
  body text NOT NULL CHECK (char_length(body) BETWEEN 5 AND 6000),
  image_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wms_announcements_active_idx ON public.wms_announcements(published_at DESC) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.wms_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.wms_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id,user_id)
);
CREATE INDEX IF NOT EXISTS wms_announcement_reads_user_idx ON public.wms_announcement_reads(user_id);

ALTER TABLE public.wms_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_announcement_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.wms_support_tickets,public.wms_announcements,public.wms_announcement_reads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.wms_support_tickets TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.wms_announcements TO authenticated;
GRANT SELECT,INSERT ON public.wms_announcement_reads TO authenticated;
-- Only own tickets can be created/read; the Developer may manage all.
CREATE POLICY wms_ticket_read ON public.wms_support_tickets FOR SELECT TO authenticated
USING (created_by = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
CREATE POLICY wms_ticket_create ON public.wms_support_tickets FOR INSERT TO authenticated
WITH CHECK (created_by = (SELECT auth.uid()) AND status='OPEN' AND developer_note IS NULL AND resolved_at IS NULL AND resolved_by IS NULL AND (branch_id IS NOT DISTINCT FROM (SELECT p.branch_id FROM public.profiles p WHERE p.id=(SELECT auth.uid()))));
CREATE POLICY wms_ticket_update ON public.wms_support_tickets FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
CREATE POLICY wms_announcement_read ON public.wms_announcements FOR SELECT TO authenticated
USING ((is_active AND published_at <= now()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
CREATE POLICY wms_announcement_create ON public.wms_announcements FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
CREATE POLICY wms_announcement_update ON public.wms_announcements FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='Developer'));
CREATE POLICY wms_reads_select ON public.wms_announcement_reads FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));
CREATE POLICY wms_reads_insert ON public.wms_announcement_reads FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.wms_announcements a WHERE a.id=announcement_id AND a.is_active AND a.published_at<=now()));

-- Images are public only for viewing. Uploads come from authenticated,
-- developer-checked Server Actions using the service_role key.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('wms-announcements','wms-announcements',true,3145728,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Initial two one-time announcements; idempotent via seed_key.
INSERT INTO public.wms_announcements(seed_key,title,body,published_at)
VALUES
('wms-20261027-transfer-cost','Transfer Sayımları ve Supabase Kullanımı',
'Bütün transfer sayımlarının bir haftaya sıkışması ile birlikte veritabanı sorgu hakkımız tükenmiştir. Ücretsiz sürüm hakları bitince çıkacak dolar bazlı ödemeden online depo amiri Buğra Erkul sorumlu olacaktır.',now()),
('wms-20261027-month-end','Ay Sonu Puantaj ve Eksik Gün Kontrolü',
'Ay sonu gelmektedir. Puantaj sorgulama bölümünden eksik günlerinizin sorgulanmasını yapınız. Olası eksik günlerinizi doldurunuz. Rapor, yıllık izin vb. var ise de giriniz.',now())
ON CONFLICT(seed_key) DO NOTHING;

