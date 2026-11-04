-- Sarf katalog revizyonunda sipariş/stok geçmişini silmeden eski kartları sakla.
alter table public.products
  add column if not exists is_active boolean not null default true,
  add column if not exists order_unit varchar(12) not null default 'ADET',
  add column if not exists units_per_unit integer;

comment on column public.products.is_active is 'False hides legacy sarf cards from product management and new order catalogs; preserves history and stock references.';
comment on column public.products.order_unit is 'Unit represented by one requested_qty: ADET, PAKET, KOLİ, RULO, TOP.';
comment on column public.products.units_per_unit is 'Known number of pieces per ordering unit. Null means not confirmed.';
