-- turuncuBOT v2 personal character state. No chat text, employee data, or medical information is stored.
create table if not exists public.bot_user_states (
 user_id uuid primary key references auth.users(id) on delete cascade,
 sugar_level integer not null default 42 check (sugar_level between 10 and 100),
 last_intent text not null default 'chat' check (last_intent in ('chat','overview','orders','cargo','transfers','stock','attendance','leaves','announcements')),
 updated_at timestamptz not null default now()
);
alter table public.bot_user_states enable row level security;
revoke all on public.bot_user_states from anon, authenticated;
grant select on public.bot_user_states to authenticated;
create policy "bot_user_states_own_read" on public.bot_user_states
 for select to authenticated using (user_id=(select auth.uid()));
create index if not exists bot_user_states_updated_idx on public.bot_user_states (updated_at desc);

-- Realtime events contain order IDs only. Depot accounts read details through protected server actions.
create policy "bot_signals_online_depot_read" on public.bot_order_signals
for select to authenticated using (
 exists (
  select 1 from public.profiles p
  join public.branches b on b.id=p.branch_id
  where p.id=(select auth.uid()) and lower(b.name)='online depo' and b.type='Depo'
 )
);
