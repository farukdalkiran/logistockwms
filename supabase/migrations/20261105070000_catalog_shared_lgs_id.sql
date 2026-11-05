-- Products, consumables and boxes share a globally unique, chronological 5-digit LGS ID.
-- Existing UUID primary keys and foreign-key relationships remain unchanged.
-- New IDs begin at 10000; the five-digit range is deliberately finite.
BEGIN;

LOCK TABLE public.products, public.boxes IN ACCESS EXCLUSIVE MODE;

CREATE SEQUENCE public.catalog_lgs_id_seq
  AS integer
  START WITH 10000
  INCREMENT BY 1
  MINVALUE 10000
  MAXVALUE 99999
  NO CYCLE;

ALTER TABLE public.products ADD COLUMN lgs_id integer;
ALTER TABLE public.boxes ADD COLUMN lgs_id integer;

-- The same timestamp can occur on many imported rows.
-- UUID and table name make historical ordering deterministic for tied timestamps.
WITH ordered AS (
  SELECT kind, id, row_number() OVER (
    ORDER BY created_at ASC, kind ASC, id ASC
  ) + 9999 AS assigned
  FROM (
    SELECT 'product'::text AS kind, id, created_at FROM public.products
    UNION ALL
    SELECT 'box'::text AS kind, id, created_at FROM public.boxes
  ) all_items
), product_ids AS (
  UPDATE public.products p SET lgs_id = o.assigned::integer
  FROM ordered o WHERE o.kind = 'product' AND o.id = p.id
  RETURNING p.id
)
UPDATE public.boxes b SET lgs_id = o.assigned::integer
FROM ordered o WHERE o.kind = 'box' AND o.id = b.id;

-- All historic IDs are assigned, then the sequence continues after the largest.
SELECT setval('public.catalog_lgs_id_seq',
  (SELECT greatest(9999, max(lgs_id)) FROM (
    SELECT lgs_id FROM public.products
    UNION ALL
    SELECT lgs_id FROM public.boxes
  ) catalog_ids),
  true
);

ALTER TABLE public.products
  ALTER COLUMN lgs_id SET DEFAULT nextval('public.catalog_lgs_id_seq'::regclass),
  ALTER COLUMN lgs_id SET NOT NULL,
  ADD CONSTRAINT products_lgs_id_5_digit CHECK (lgs_id BETWEEN 10000 AND 99999),
  ADD CONSTRAINT products_lgs_id_unique UNIQUE (lgs_id);

ALTER TABLE public.boxes
  ALTER COLUMN lgs_id SET DEFAULT nextval('public.catalog_lgs_id_seq'::regclass),
  ALTER COLUMN lgs_id SET NOT NULL,
  ADD CONSTRAINT boxes_lgs_id_5_digit CHECK (lgs_id BETWEEN 10000 AND 99999),
  ADD CONSTRAINT boxes_lgs_id_unique UNIQUE (lgs_id);

-- Existing authenticated warehouse insert policies need sequence USAGE for defaults.
GRANT USAGE ON SEQUENCE public.catalog_lgs_id_seq TO authenticated;
COMMIT;
