-- Web oturumu ve 5 haneli personel/terminal kimliği arasındaki açık ilişki.
-- Eski web hesaplarının employee_id alanı boş kalır; yeni hesaplarda server action zorunlu doldurur.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id varchar(5);
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_employee_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_id_unique
  ON public.profiles(employee_id) WHERE employee_id IS NOT NULL;
COMMENT ON COLUMN public.profiles.employee_id IS
  'Web hesabı ile aynı kişiye ait 5 haneli employees.id kimliğinin bire bir eşleştirilmesi. Eski kayıtlar nullable.';
