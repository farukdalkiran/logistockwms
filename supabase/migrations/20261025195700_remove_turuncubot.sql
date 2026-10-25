-- Remove the retired turuncuBOT feature; preserve business tables and order approval procedures.
-- Historical creation migrations stay in source control so replay + cleanup remains consistent.
drop trigger if exists bot_order_items_changed on public.order_items;
drop function if exists bot_private.signal_order_from_item();
-- Real-time publication membership must be removed before dropping publication tables.
do $$
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bot_order_signals') then
      alter publication supabase_realtime drop table public.bot_order_signals;
    end if;
    if exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bot_announcements') then
      alter publication supabase_realtime drop table public.bot_announcements;
    end if;
  end if;
end $$;
drop table if exists public.bot_announcement_reads;
drop table if exists public.bot_announcements;
drop table if exists public.bot_calendar_exceptions;
drop table if exists public.bot_order_signals;
drop table if exists public.bot_user_states;
drop schema if exists bot_private;
