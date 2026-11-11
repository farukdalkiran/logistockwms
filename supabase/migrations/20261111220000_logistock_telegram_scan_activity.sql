-- Five-minute throttling per cargo session / transfer protects Telegram free rate limits.
create table if not exists public.telegram_activity_throttle (
 source text not null,
 entity_id uuid not null,
 last_sent_at timestamptz not null,
 primary key(source,entity_id)
);
alter table public.telegram_activity_throttle enable row level security;
revoke all on public.telegram_activity_throttle from anon,authenticated;
grant select,insert,update on public.telegram_activity_throttle to service_role;
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
 elsif tg_table_name='cargo_logs' then
   if tg_op='INSERT' and new.scanned_at is not null and abs(extract(epoch from (now()-new.scanned_at)))<180 then
      insert into public.telegram_activity_throttle(source,entity_id,last_sent_at)
       values('cargo',new.session_id,now())
       on conflict(source,entity_id) do update set last_sent_at=excluded.last_sent_at
       where public.telegram_activity_throttle.last_sent_at < now()-interval '5 minutes'
       returning true into should_send;
   end if;
 elsif tg_table_name='scan_logs' then
   if tg_op='INSERT' and new.status='SUCCESS' and new.created_at is not null
      and abs(extract(epoch from (now()-new.created_at)))<180 then
      insert into public.telegram_activity_throttle(source,entity_id,last_sent_at)
       values('transfer',new.transfer_id,now())
       on conflict(source,entity_id) do update set last_sent_at=excluded.last_sent_at
       where public.telegram_activity_throttle.last_sent_at < now()-interval '5 minutes'
       returning true into should_send;
   end if;
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

drop trigger if exists logistock_telegram_cargo_logs on public.cargo_logs;
create trigger logistock_telegram_cargo_logs after insert on public.cargo_logs
 for each row execute function public.logistock_telegram_db_notify();
drop trigger if exists logistock_telegram_scan_logs on public.scan_logs;
create trigger logistock_telegram_scan_logs after insert on public.scan_logs
 for each row execute function public.logistock_telegram_db_notify();
