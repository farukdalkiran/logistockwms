-- Idempotent schema patch for store-confirmed receipt of WMS orders.
-- Applied to Supabase on 2026-10-26; retains existing orders and approval flow.
alter table public.orders
  add column if not exists delivered_at timestamptz;

alter table public.orders
  add column if not exists received_by uuid references auth.users(id);

comment on column public.orders.delivered_at
  is 'Timestamp of receipt confirmed by the originating store (UTC in database).';
comment on column public.orders.received_by
  is 'Authenticated user who confirmed physical store receipt.';
