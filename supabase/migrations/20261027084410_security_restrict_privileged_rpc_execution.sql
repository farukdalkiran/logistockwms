-- Applied to Logistock production on 2026-10-27.
-- Preserve authenticated server operation while restricting direct RPC execution.
REVOKE EXECUTE ON FUNCTION public.get_db_size() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_password_update() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.get_db_size() SET search_path = pg_catalog;
ALTER FUNCTION public.handle_password_update() SET search_path = pg_catalog;
