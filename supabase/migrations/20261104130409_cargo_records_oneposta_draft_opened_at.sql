-- Kaydın 1Posta taslak butonundan ne zaman açıldığını takip eder.
-- Bu alan gerçek e-posta gönderimini onaylamaz; eski kayıtları değiştirmez.
alter table public.cargo_records
  add column if not exists oneposta_opened_at timestamptz;

comment on column public.cargo_records.oneposta_opened_at is
  '1Posta taslak butonunun en son acildigi zaman. Gercek e-posta gonderimi dogrulamaz.';
