-- Consolidate the three public REST HEAD count operations into one service-role-only RPC.
-- Restricted EXECUTE; the function is SECURITY INVOKER (not definer).
CREATE OR REPLACE FUNCTION public.wms_home_order_counts(p_branch_id uuid)
RETURNS TABLE(pending bigint, preparing bigint, ready_to_ship bigint)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = ''
AS $fn$
SELECT
  count(*) FILTER (WHERE o.status='PENDING'),
  count(*) FILTER (WHERE o.status='PREPARING'),
  count(*) FILTER (WHERE o.status='READY_TO_SHIP')
FROM public.orders o
WHERE (o.approval_branch_id IS NULL OR o.approval_branch_id = p_branch_id)
  AND o.status IN ('PENDING','PREPARING','READY_TO_SHIP')
$fn$;
REVOKE ALL ON FUNCTION public.wms_home_order_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wms_home_order_counts(uuid) TO service_role;
