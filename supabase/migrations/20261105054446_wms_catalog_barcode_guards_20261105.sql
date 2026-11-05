-- WMS katalog/koli güvenliği. Mevcut kayıtlar silinmez veya değiştirilmez.
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_normalized_uidx
  ON public.products ((upper(btrim(barcode))));
CREATE UNIQUE INDEX IF NOT EXISTS boxes_barcode_normalized_uidx
  ON public.boxes ((upper(btrim(box_barcode))));
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_normalized_uidx
  ON public.products ((upper(btrim(sku))))
  WHERE nullif(btrim(sku), '') IS NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_nonempty_barcode_chk CHECK (btrim(barcode) <> '') NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_nonempty_barcode_chk;
ALTER TABLE public.boxes
  ADD CONSTRAINT boxes_nonempty_barcode_chk CHECK (btrim(box_barcode) <> '') NOT VALID,
  ADD CONSTRAINT boxes_positive_quantity_chk CHECK (quantity > 0) NOT VALID;
ALTER TABLE public.boxes VALIDATE CONSTRAINT boxes_nonempty_barcode_chk;
ALTER TABLE public.boxes VALIDATE CONSTRAINT boxes_positive_quantity_chk;

-- Cross-table insert races are serialized by normalized barcode.
CREATE OR REPLACE FUNCTION public.check_box_barcode_collision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  NEW.box_barcode := upper(btrim(NEW.box_barcode));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.box_barcode, 0));
  IF EXISTS (
    SELECT 1 FROM public.products p
    WHERE upper(btrim(p.barcode)) = NEW.box_barcode
       OR EXISTS (SELECT 1 FROM unnest(coalesce(p.alt_barcodes, '{}'::text[])) AS alt(code)
                  WHERE upper(btrim(alt.code)) = NEW.box_barcode)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Bu barkod mevcut bir ürün kartına ait. Koli barkodu olarak kullanılamaz.';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.check_product_barcode_collision()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  NEW.barcode := upper(btrim(NEW.barcode));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.barcode, 0));
  IF EXISTS (SELECT 1 FROM public.boxes b WHERE upper(btrim(b.box_barcode)) = NEW.barcode) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Bu barkod mevcut bir koli kartına ait. Ürün barkodu olarak kullanılamaz.';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_check_product_barcode_collision ON public.products;
CREATE TRIGGER trg_check_product_barcode_collision
BEFORE INSERT OR UPDATE OF barcode ON public.products
FOR EACH ROW EXECUTE FUNCTION public.check_product_barcode_collision();

-- Users with a store-only profile can read master data but cannot modify it.
DROP POLICY IF EXISTS "Products Full Access For Authenticated" ON public.products;
CREATE POLICY products_catalog_read ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_catalog_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND p.role IN ('Developer', 'Admin', 'ADMNWH', 'WAREHOUSE')));
CREATE POLICY products_catalog_update ON public.products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND p.role IN ('Developer', 'Admin', 'ADMNWH', 'WAREHOUSE')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND p.role IN ('Developer', 'Admin', 'ADMNWH', 'WAREHOUSE')));
CREATE POLICY products_catalog_delete ON public.products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND p.role IN ('Developer', 'Admin', 'ADMNWH', 'WAREHOUSE')));
