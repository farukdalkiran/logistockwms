-- Authoritative route authorization for the management panel.
-- Uses the authenticated JWT subject and the existing page-editor tables.
-- SECURITY INVOKER respects existing RLS on profiles, roles and system_modules.
CREATE OR REPLACE FUNCTION public.wms_can_access_management_route(requested_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  path_to_check text := rtrim(split_part(coalesce(requested_path, ''), '?', 1), '/');
  actor_role text;
  actor_permissions text[];
  required_module text;
  module_active boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF path_to_check = '' THEN
    path_to_check := '/';
  END IF;
  IF path_to_check <> '/management'
     AND left(path_to_check, 12) <> '/management/' THEN
    RETURN false;
  END IF;

  -- Role comes from the database profile, never client-supplied metadata.
  SELECT p.role::text, r.permissions
  INTO actor_role, actor_permissions
  FROM public.profiles AS p
  LEFT JOIN public.roles AS r ON r.role_code = p.role::text
  WHERE p.id = auth.uid();

  IF actor_role IS NULL THEN
    RETURN false;
  END IF;

  -- Developer remains the sole unconditional administrator.
  IF actor_role = 'Developer' THEN
    RETURN true;
  END IF;

  IF path_to_check IN ('/management', '/management/unauthorized') THEN
    RETURN true;
  END IF;

  -- Exact route takes priority. Child menu entries outrank category entries
  -- that share the same URL (e.g. hr_insights, products_catalog, role_settings).
  SELECT sm.id, sm.is_active INTO required_module, module_active
  FROM public.system_modules AS sm
  WHERE rtrim(sm.path, '/') = path_to_check
  ORDER BY (sm.parent_id IS NOT NULL) DESC, sm.sort_order DESC, sm.id
  LIMIT 1;

  IF FOUND THEN
    RETURN module_active IS TRUE
       AND coalesce(required_module = ANY(actor_permissions), false);
  END IF;

  -- Legacy routes with no page-editor row. Reuse an existing permission
  -- rather than allowing everything under /management automatically.
  required_module := CASE path_to_check
    WHEN '/management/inventory' THEN 'inventory_view'
    WHEN '/management/cargo' THEN 'cargo'
    WHEN '/management/orders/history' THEN 'store_order_confirm'
    WHEN '/management/orders/store-orders' THEN 'store_order_confirm'
    WHEN '/management/eksik-parca/performance' THEN 'eksik_parca_performance'
    ELSE NULL
  END;
  IF required_module IS NOT NULL THEN
    RETURN coalesce(required_module = ANY(actor_permissions), false);
  END IF;

  -- No implicit access to unregistered nested routes. A new page must have
  -- its own exact module entry or an explicitly audited legacy alias.
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.wms_can_access_management_route(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wms_can_access_management_route(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.wms_can_access_management_route(text) TO authenticated;

COMMENT ON FUNCTION public.wms_can_access_management_route(text) IS
  'Checks the signed-in user against page-editor system_modules and roles; unknown management routes fail closed.';
