-- Atomic and audited leave balance edits. Only server-side service_role may execute.
-- No existing employee data is modified by this migration.
create or replace function public.wms_hr_adjust_leave_balances(
  p_updates jsonb,
  p_actor uuid,
  p_scope_branch uuid default null,
  p_reason text default 'İK izin bakiyesi güncellemesi'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  target_id text;
  new_balance numeric;
  expected_balance numeric;
  new_employment_date date;
  previous public.employees%rowtype;
  updated_count integer := 0;
  unchanged_count integer := 0;
  seen_ids text[] := array[]::text[];
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Bu işlem yalnızca yetkili sunucu tarafından yapılabilir.';
  end if;
  if p_actor is null then raise exception 'İşlemi yapan kullanıcı zorunludur.'; end if;
  if p_reason is null or length(trim(p_reason)) < 5 or length(p_reason) > 300 then
    raise exception 'İşlem açıklaması 5-300 karakter olmalıdır.';
  end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'array'
    or jsonb_array_length(p_updates) = 0 or jsonb_array_length(p_updates) > 250 then
    raise exception 'İşlem 1 ile 250 personel içermelidir.';
  end if;

  for item in select value from jsonb_array_elements(p_updates)
  loop
    target_id := item->>'id';
    if target_id is null or target_id !~ '^[0-9]{5}$' then
      raise exception 'Geçersiz personel ID: %', target_id;
    end if;
    if target_id = any(seen_ids) then
      raise exception 'Dosyada aynı personel ID tekrar ediyor: %', target_id;
    end if;
    seen_ids := array_append(seen_ids, target_id);
    if jsonb_typeof(item->'leave_balance') not in ('number','string') then
      raise exception 'İzin bakiyesi sayısal olmalıdır: %', target_id;
    end if;
    new_balance := (item->>'leave_balance')::numeric;
    if new_balance < -14 or new_balance > 999 or new_balance <> round(new_balance,2) then
      raise exception 'İzin bakiyesi -14 ile 999 arasında ve en fazla 2 ondalıklı olmalı: %', target_id;
    end if;
    if not (item ? 'expected_balance') then
      raise exception 'Personelin önceki izin bakiyesi belirtilmeli: %', target_id;
    end if;
    expected_balance := (item->>'expected_balance')::numeric;
    if item ? 'employment_date' and nullif(item->>'employment_date','') is not null then
      if item->>'employment_date' !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'İşe giriş tarihi geçersiz: %', target_id;
      end if;
      new_employment_date := (item->>'employment_date')::date;
    else
      new_employment_date := null;
    end if;

    select * into previous from public.employees where id = target_id for update;
    if not found then raise exception 'Personel bulunamadı: %', target_id; end if;
    if not previous.is_active then raise exception 'Pasif personel düzenlenemez: %', target_id; end if;
    if p_scope_branch is not null and previous.branch_id is distinct from p_scope_branch then
      raise exception 'Başka bir şubenin personeli değiştirilemez: %', target_id;
    end if;
    if previous.leave_balance is distinct from expected_balance then
      raise exception 'İzin bakiyesi bu sırada değişmiş; sayfayı yenileyin: %', target_id;
    end if;
    if previous.leave_balance is not distinct from new_balance
      and (new_employment_date is null or previous.employment_date is not distinct from new_employment_date) then
      unchanged_count := unchanged_count + 1;
      continue;
    end if;
    update public.employees
      set leave_balance = new_balance,
          employment_date = coalesce(new_employment_date, previous.employment_date)
      where id = target_id;
    insert into public.transaction_logs(
      employee_id, branch_id, action_type, description, old_value, new_value
    ) values (
      target_id, previous.branch_id, 'HR_LEAVE_BALANCE_EDIT',
      'İK izin bakiyesi / işe giriş düzenlemesi. Kullanıcı: ' || p_actor::text || '. Açıklama: ' || trim(p_reason),
      jsonb_build_object('leave_balance',previous.leave_balance,'employment_date',previous.employment_date)::text,
      jsonb_build_object('leave_balance',new_balance,
        'employment_date',coalesce(new_employment_date,previous.employment_date))::text
    );
    updated_count := updated_count + 1;
  end loop;
  return jsonb_build_object('updated',updated_count,'unchanged',unchanged_count);
end;
$$;

revoke all on function public.wms_hr_adjust_leave_balances(jsonb,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.wms_hr_adjust_leave_balances(jsonb,uuid,uuid,text) to service_role;
