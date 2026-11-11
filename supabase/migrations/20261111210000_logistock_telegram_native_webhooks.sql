-- Logistock Telegram: service-only settings, no secrets committed.
create extension if not exists pg_net with schema extensions;
create table if not exists public.telegram_runtime_config (
 id smallint primary key default 1 check (id=1),
 allowed_chat_ids text[] not null default array['909182985']::text[],
 telegram_webhook_secret text not null default encode(gen_random_bytes(32),'hex'),
 db_hook_secret text not null default encode(gen_random_bytes(32),'hex'),
 setup_secret text not null default encode(gen_random_bytes(32),'hex'),
 setup_consumed boolean not null default false,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.telegram_runtime_config enable row level security;
revoke all on table public.telegram_runtime_config from anon,authenticated;
grant select,update on table public.telegram_runtime_config to service_role;
insert into public.telegram_runtime_config(id) values(1) on conflict (id) do nothing;
create or replace function public.logistock_telegram_db_notify()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 cfg record;
 rec jsonb;
 oldrec jsonb;
 should_send boolean := false;
begin
 select enabled,db_hook_secret into cfg from public.telegram_runtime_config where id=1;
 if cfg.enabled is not true then return new; end if;
 rec:=to_jsonb(new);
 oldrec:=case when tg_op='UPDATE' then to_jsonb(old) else null end;
 if tg_table_name='attendance' then
   if coalesce(new.status,'') like 'LEAVE_%' then return new; end if;
   if tg_op='INSERT' and new.check_in_time is not null and new.check_out_time is null
      and abs(extract(epoch from (now()-new.check_in_time))) < 180 then should_send:=true; end if;
   if tg_op='UPDATE' and old.check_out_time is null and new.check_out_time is not null
      and coalesce(new.status,'') <> 'AUTO_CLOSED_MISSING_OUT'
      and abs(extract(epoch from (now()-new.check_out_time))) < 180 then should_send:=true; end if;
 elsif tg_table_name='cargo_sessions' then
   if tg_op='INSERT' and abs(extract(epoch from (now()-new.started_at)))<180 then should_send:=true; end if;
   if tg_op='UPDATE' and old.status is distinct from new.status
      and new.status='COMPLETED' and new.completed_at is not null
      and abs(extract(epoch from (now()-new.completed_at)))<180 then should_send:=true; end if;
 elsif tg_table_name='transfers' then
   if tg_op='INSERT' and abs(extract(epoch from (now()-new.created_at)))<180 then should_send:=true; end if;
   if tg_op='UPDATE' and (old.status is distinct from new.status or old.picker_employee_id is distinct from new.picker_employee_id) then should_send:=true; end if;
 end if;
 if not should_send then return new; end if;
 perform net.http_post(
   url:='https://pbqzbakmxrdumaeamymd.supabase.co/functions/v1/logistock-telegram',
   headers:=jsonb_build_object('content-type','application/json','x-logistock-event-secret',cfg.db_hook_secret),
   body:=jsonb_build_object('type',tg_op,'schema',tg_table_schema,'table',tg_table_name,'record',rec,'old_record',oldrec),
   timeout_milliseconds:=5000
 );
 return new;
exception when others then
 raise warning 'Telegram webhook enqueue failed for %: %',tg_table_name,sqlerrm;
 return new;
end $$;
revoke all on function public.logistock_telegram_db_notify() from public,anon,authenticated;
drop trigger if exists logistock_telegram_attendance on public.attendance;
create trigger logistock_telegram_attendance after insert or update on public.attendance
 for each row execute function public.logistock_telegram_db_notify();
drop trigger if exists logistock_telegram_cargo_sessions on public.cargo_sessions;
create trigger logistock_telegram_cargo_sessions after insert or update on public.cargo_sessions
 for each row execute function public.logistock_telegram_db_notify();
drop trigger if exists logistock_telegram_transfers on public.transfers;
create trigger logistock_telegram_transfers after insert or update on public.transfers
 for each row execute function public.logistock_telegram_db_notify();
