-- Previous emreBOT policy granted non-depot managers Realtime order IDs.
-- turuncuBOT events are now restricted by bot_signals_online_depot_read.
drop policy if exists "emrebot managers can receive order event IDs" on public.bot_order_signals;