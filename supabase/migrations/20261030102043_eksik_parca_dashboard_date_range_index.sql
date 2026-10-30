-- Seçili tarih aralığındaki kargo işlem analitiğini tüm tablo taramasından kurtarır.
-- Supabase üzerinde 2026-10-30 tarihinde uygulanmıştır.
CREATE INDEX IF NOT EXISTS idx_cargo_records_created_at_id ON public.cargo_records (created_at, id);
