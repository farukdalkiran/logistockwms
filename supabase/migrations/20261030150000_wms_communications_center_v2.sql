-- WMS iletişim merkezi v2: mevcut kayıtları ve okundu geçmişini koruyarak genişletir.
ALTER TABLE public.wms_support_tickets
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
ALTER TABLE public.wms_support_tickets DROP CONSTRAINT IF EXISTS wms_support_tickets_priority_check;
ALTER TABLE public.wms_support_tickets ADD CONSTRAINT wms_support_tickets_priority_check CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT'));
CREATE INDEX IF NOT EXISTS wms_support_tickets_active_v2_idx
  ON public.wms_support_tickets(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS wms_support_tickets_assignee_v2_idx
  ON public.wms_support_tickets(assigned_to,updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.wms_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.wms_support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  sender_name text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wms_support_messages_ticket_time_idx
  ON public.wms_support_messages(ticket_id,created_at,id);

CREATE TABLE IF NOT EXISTS public.wms_support_ticket_views (
  ticket_id uuid NOT NULL REFERENCES public.wms_support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ticket_id,user_id)
);
CREATE INDEX IF NOT EXISTS wms_support_ticket_views_user_idx
  ON public.wms_support_ticket_views(user_id,last_read_at DESC);

ALTER TABLE public.wms_announcements
  ADD COLUMN IF NOT EXISTS target_branch_ids uuid[],
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.wms_announcements DROP CONSTRAINT IF EXISTS wms_announcements_priority_check;
ALTER TABLE public.wms_announcements ADD CONSTRAINT wms_announcements_priority_check CHECK (priority IN ('NORMAL','IMPORTANT','URGENT'));
ALTER TABLE public.wms_announcements DROP CONSTRAINT IF EXISTS wms_announcements_revision_check;
ALTER TABLE public.wms_announcements ADD CONSTRAINT wms_announcements_revision_check CHECK (revision >= 1);
ALTER TABLE public.wms_announcement_reads ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS wms_announcements_manage_idx
  ON public.wms_announcements(deleted_at,created_at DESC);
CREATE INDEX IF NOT EXISTS wms_announcement_reads_revision_idx
  ON public.wms_announcement_reads(announcement_id,revision);

-- Duyuru erişimi: tek şube (eski), birden fazla şube (yeni) veya bütün şubeler.
DROP POLICY IF EXISTS wms_announcement_read ON public.wms_announcements;
CREATE POLICY wms_announcement_read ON public.wms_announcements FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND lower(p.role)='developer')
  OR (
    deleted_at IS NULL AND is_active AND published_at<=now()
    AND (expires_at IS NULL OR expires_at>now())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=(SELECT auth.uid())
        AND (
          (target_branch_ids IS NULL AND (target_branch_id IS NULL OR target_branch_id=p.branch_id))
          OR (p.branch_id=ANY(target_branch_ids))
        )
    )
  )
);
DROP POLICY IF EXISTS wms_reads_insert ON public.wms_announcement_reads;
CREATE POLICY wms_reads_insert ON public.wms_announcement_reads FOR INSERT TO authenticated
WITH CHECK (
 user_id=(SELECT auth.uid())
 AND EXISTS (
  SELECT 1 FROM public.wms_announcements a JOIN public.profiles p ON p.id=(SELECT auth.uid())
  WHERE a.id=announcement_id AND a.deleted_at IS NULL AND a.is_active
  AND a.published_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())
  AND (
    (a.target_branch_ids IS NULL AND (a.target_branch_id IS NULL OR a.target_branch_id=p.branch_id))
    OR p.branch_id=ANY(a.target_branch_ids)
  )
 )
);
DROP POLICY IF EXISTS wms_reads_update ON public.wms_announcement_reads;
CREATE POLICY wms_reads_update ON public.wms_announcement_reads FOR UPDATE TO authenticated
USING (user_id=(SELECT auth.uid()))
WITH CHECK (user_id=(SELECT auth.uid()));

-- Yeni mesajlaşma ve okundu tabloları RLS ile korunur. İstemcinin keyfi hesapları okuması engellenir.
ALTER TABLE public.wms_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_support_ticket_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wms_support_messages,public.wms_support_ticket_views FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.wms_support_messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.wms_support_ticket_views TO authenticated;

DROP POLICY IF EXISTS wms_support_messages_read ON public.wms_support_messages;
CREATE POLICY wms_support_messages_read ON public.wms_support_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND lower(p.role)='developer')
  OR (NOT is_internal AND EXISTS (
    SELECT 1 FROM public.wms_support_tickets t
    WHERE t.id=ticket_id AND t.created_by=(SELECT auth.uid())
  ))
);
DROP POLICY IF EXISTS wms_support_messages_create ON public.wms_support_messages;
CREATE POLICY wms_support_messages_create ON public.wms_support_messages FOR INSERT TO authenticated
WITH CHECK (
 sender_id=(SELECT auth.uid())
 AND EXISTS (
  SELECT 1 FROM public.wms_support_tickets t
  WHERE t.id=ticket_id AND t.archived_at IS NULL AND t.status<>'COMPLETED'
  AND (
    (t.created_by=(SELECT auth.uid()) AND NOT is_internal)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND lower(p.role)='developer')
  )
 )
);
DROP POLICY IF EXISTS wms_support_ticket_views_read ON public.wms_support_ticket_views;
CREATE POLICY wms_support_ticket_views_read ON public.wms_support_ticket_views FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS wms_support_ticket_views_insert ON public.wms_support_ticket_views;
CREATE POLICY wms_support_ticket_views_insert ON public.wms_support_ticket_views FOR INSERT TO authenticated
WITH CHECK (
 user_id=(SELECT auth.uid())
 AND EXISTS (SELECT 1 FROM public.wms_support_tickets t WHERE t.id=ticket_id
   AND (t.created_by=(SELECT auth.uid()) OR EXISTS (
     SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND lower(p.role)='developer'
   ))
 )
);
DROP POLICY IF EXISTS wms_support_ticket_views_update ON public.wms_support_ticket_views;
CREATE POLICY wms_support_ticket_views_update ON public.wms_support_ticket_views FOR UPDATE TO authenticated
USING (user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));

-- Eski duyuru ekleme / düzenleme izinleri korunur, silme uygulama seviyesinde soft-delete olur.
