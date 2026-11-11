-- Telegram event idempotency; this migration is NOT deployed until rollout.
create table if not exists public.telegram_notification_events (
  event_key text primary key,
  created_at timestamptz not null default now()
);
alter table public.telegram_notification_events enable row level security;
revoke all on public.telegram_notification_events from anon, authenticated;
comment on table public.telegram_notification_events is 'Internal service-only Telegram attendance notification deduplication.';
