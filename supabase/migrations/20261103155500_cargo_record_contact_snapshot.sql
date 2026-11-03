-- cargo_records must remain self-contained when an ERP import profile is deleted.
-- Additive migration only: no deletions, no existing values overwritten by null.
begin;

alter table public.cargo_records
  add column if not exists email text,
  add column if not exists street text,
  add column if not exists street_2 text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists postal_code text,
  add column if not exists country text;

-- Backfill historical cargo records while the source files still exist.
-- Require exact delivery, SD document, and customer name to avoid cross-customer PII.
-- If multiple rows refer to the same shipment, use the newest source row.
with matching_source as (
  select distinct on (c.id)
    c.id as cargo_id,
    nullif(btrim(e.email), '') as email,
    nullif(btrim(e.street), '') as street,
    nullif(btrim(e.street_2), '') as street_2,
    nullif(btrim(e.city), '') as city,
    nullif(btrim(e.region), '') as region,
    nullif(btrim(e.postal_code), '') as postal_code,
    nullif(btrim(e.country), '') as country
  from public.cargo_records c
  join public.erp_raw_shipments e
    on e.delivery_number = c.delivery_number
   and e.sd_document = c.sd_document
   and upper(btrim(coalesce(e.customer_name, ''))) =
       upper(btrim(coalesce(c.customer_name, '')))
  order by c.id, e.created_at desc, e.id desc
)
update public.cargo_records c
set
  email = coalesce(nullif(btrim(c.email), ''), s.email),
  street = coalesce(nullif(btrim(c.street), ''), s.street),
  street_2 = coalesce(nullif(btrim(c.street_2), ''), s.street_2),
  city = coalesce(nullif(btrim(c.city), ''), s.city),
  region = coalesce(nullif(btrim(c.region), ''), s.region),
  postal_code = coalesce(nullif(btrim(c.postal_code), ''), s.postal_code),
  country = coalesce(nullif(btrim(c.country), ''), s.country)
from matching_source s
where c.id = s.cargo_id
  and (
    (nullif(btrim(c.email), '') is null and s.email is not null)
    or (nullif(btrim(c.street), '') is null and s.street is not null)
    or (nullif(btrim(c.street_2), '') is null and s.street_2 is not null)
    or (nullif(btrim(c.city), '') is null and s.city is not null)
    or (nullif(btrim(c.region), '') is null and s.region is not null)
    or (nullif(btrim(c.postal_code), '') is null and s.postal_code is not null)
    or (nullif(btrim(c.country), '') is null and s.country is not null)
  );

commit;
