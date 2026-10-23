-- emreBOT | non-destructive v1 (2026-10)
create table if not exists public.bot_announcements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null,
  category text not null default 'GENERAL' check (category in ('GENERAL','HR','IMPORTANT')),
  priority smallint not null default 1 check (priority between 1 and 3),
  is_active boolean not null default true,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  action_label text,
  action_href text,
  show_missing_attendance boolean not null default false,
  created_at timestamptz not null default now(),
  constraint bot_announcement_valid_window check (ends_at > starts_at)
);
create index if not exists bot_announcements_active_idx on public.bot_announcements (starts_at,ends_at) where is_active;

create table if not exists public.bot_announcement_reads (
  announcement_id uuid not null references public.bot_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id,user_id)
);
create index if not exists bot_announcement_reads_user_idx on public.bot_announcement_reads(user_id,read_at desc);

create table if not exists public.bot_calendar_exceptions (
  id bigint generated always as identity primary key,
  day date not null,
  branch_id uuid references public.branches(id) on delete cascade,
  label text not null,
  is_workday boolean not null default false
);
create unique index if not exists bot_calendar_global_unique on public.bot_calendar_exceptions(day) where branch_id is null;
create unique index if not exists bot_calendar_branch_unique on public.bot_calendar_exceptions(day,branch_id) where branch_id is not null;

create table if not exists public.bot_order_signals (
  order_id uuid primary key references public.orders(id) on delete cascade,
  changed_at timestamptz not null default now()
);
create index if not exists bot_order_signals_recent_idx on public.bot_order_signals(changed_at desc);

alter table public.bot_announcements enable row level security;
alter table public.bot_announcement_reads enable row level security;
alter table public.bot_calendar_exceptions enable row level security;
alter table public.bot_order_signals enable row level security;

revoke all on public.bot_announcements,public.bot_announcement_reads,public.bot_calendar_exceptions,public.bot_order_signals from anon,authenticated;
grant select on public.bot_announcements to authenticated;
grant select,insert,update on public.bot_announcement_reads to authenticated;
grant select on public.bot_order_signals to authenticated;

create policy "emrebot announcements visible to signed-in users" on public.bot_announcements
  for select to authenticated using (is_active);
create policy "emrebot own read history" on public.bot_announcement_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy "emrebot mark own read" on public.bot_announcement_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "emrebot update own read" on public.bot_announcement_reads
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "emrebot managers can receive order event IDs" on public.bot_order_signals
  for select to authenticated using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
      and p.role in ('Developer','Admin','ADMNWH')
    )
  );

create schema if not exists bot_private;
revoke all on schema bot_private from public;
create or replace function bot_private.signal_order_from_item()
returns trigger
language plpgsql security definer
set search_path = pg_catalog,public
as $fn$
begin
  if new.order_id is not null then
    insert into public.bot_order_signals(order_id,changed_at)
    values (new.order_id, clock_timestamp())
    on conflict (order_id) do update set changed_at = excluded.changed_at;
  end if;
  return new;
end
$fn$;
revoke all on function bot_private.signal_order_from_item() from public;
drop trigger if exists bot_order_items_changed on public.order_items;
create trigger bot_order_items_changed
after insert or update of requested_qty on public.order_items
for each row execute function bot_private.signal_order_from_item();

do $do$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bot_order_signals') then
    alter publication supabase_realtime add table public.bot_order_signals;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bot_announcements') then
    alter publication supabase_realtime add table public.bot_announcements;
  end if;
end
$do$;

insert into public.bot_announcements(slug,title,body,category,priority,starts_at,ends_at,action_label,action_href,show_missing_attendance)
values (
  'month-end-attendance-2026-10',
  'Ay Sonu Mesai Kontrolü',
  'Ekim ayı mesai listeleri iletilmeden önce eksik günlerinizi tamamlayınız. Yıllık izinlerinizin ve sağlık raporlarınızın eksiksiz takip edilip sisteme işlendiğini kontrol ediniz. Eksik kayıtlar için personel veya İK birimiyle iletişime geçiniz.',
  'HR',3,'2026-10-28 00:00:00+03','2026-10-30 00:00:00+03',
  'Mesai Listesini İncele','/management/hr/reports',true
) on conflict (slug) do nothing;

insert into public.bot_calendar_exceptions(day,label,is_workday)
values ('2026-10-29','Cumhuriyet Bayramı',false)
on conflict do nothing;
