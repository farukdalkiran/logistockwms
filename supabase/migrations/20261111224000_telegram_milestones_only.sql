-- Only actionable milestones send Telegram alerts: attendance in/out,
-- cargo session start, and transfer's first transition to Tamamlandi.
-- No barcode-activity, picker-assignment, transfer-create, or cargo-complete alerts.
create or replace function public.logistock_telegram_db_notify()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
 cfg record;
 event_rec jsonb;
 previous_rec jsonb;
begin
 select enabled,db_hook_secret into cfg from public.telegram_runtime_config where id=1;
 if cfg.enabled is distinct from true then return new; end if;

 if tg_table_name='attendance' then
   if coalesce(new.status,'') like 'LEAVE_%' then return new; end if;
   if tg_op='INSERT' then
     if new.check_in_time is null or new.check_out_time is not null
       or abs(extract(epoch from (now()-new.check_in_time)))>=180 then
       return new;
     end if;
   elsif tg_op='UPDATE' then
     if old.check_out_time is not null or new.check_out_time is null
       or coalesce(new.status,'')='AUTO_CLOSED_MISSING_OUT'
       or abs(extract(epoch from (now()-new.check_out_time)))>=180 then
       return new;
     end if;
   else return new;
   end if;
 elsif tg_table_name='cargo_sessions' and tg_op='INSERT' then
   if new.started_at is null
     or abs(extract(epoch from (now()-new.started_at)))>=180 then return new; end if;
 elsif tg_table_name='transfers' and tg_op='UPDATE' then
   if old.status is not distinct from new.status
     or new.status is distinct from 'Tamamlandi' then return new; end if;
 else
   return new;
 end if;

 event_rec := to_jsonb(new);
 previous_rec := case when tg_op='UPDATE' then to_jsonb(old) else null end;
 perform net.http_post(
   url:='https://pbqzbakmxrdumaeamymd.supabase.co/functions/v1/logistock-telegram',
   headers:=jsonb_build_object('content-type','application/json','x-logistock-event-secret',cfg.db_hook_secret),
   body:=jsonb_build_object('type',tg_op,'schema',tg_table_schema,'table',tg_table_name,'record',event_rec,'old_record',previous_rec,'event_at',now()),
   timeout_milliseconds:=5000
 );
 return new;
exception when others then
 raise warning 'Telegram notification enqueue failed for %: %',tg_table_name,sqlerrm;
 return new;
end $$;

drop trigger if exists logistock_telegram_cargo_logs on public.cargo_logs;
drop trigger if exists logistock_telegram_scan_logs on public.scan_logs;

drop trigger if exists logistock_telegram_cargo_sessions on public.cargo_sessions;
create trigger logistock_telegram_cargo_sessions
after insert on public.cargo_sessions
for each row execute function public.logistock_telegram_db_notify();

drop trigger if exists logistock_telegram_transfers on public.transfers;
create trigger logistock_telegram_transfers
after update on public.transfers
for each row execute function public.logistock_telegram_db_notify();
