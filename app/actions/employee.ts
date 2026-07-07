'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Şube Filtreli Şube Getirme Motoru
export async function getBranches(branchId: string | null, isGlobal: boolean) {
  const supabase = await createClient();
  let query = supabase.from('branches').select('id, name, type').order('name', { ascending: true });

  // Eğer yetkili Global değilse, SADECE kendi şubesini görebilir
  if (!isGlobal && branchId) {
    query = query.eq('id', branchId);
  }

  const { data, error } = await query;
  if (error) throw new Error('Şubeler getirilemedi: ' + error.message);
  return data;
}

// Şube Filtreli Personel Getirme Motoru
export async function getEmployees(branchId: string | null, isGlobal: boolean) {
  const supabase = await createClient();
  let query = supabase.from('employees').select('*, branches(name)').order('created_at', { ascending: false });

  // Sorgu Sıkıyönetimi: Sadece yöneticinin bulunduğu şubenin personellerini çek
  if (!isGlobal && branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw new Error('Personeller getirilemedi: ' + error.message);
  return data;
}

// Personel Oluşturma Motoru (Revize Edildi: Opsiyonel Özel ID Desteği Eklendi)
export async function createEmployee(formData: {
  id?: string; // Developer'ın gireceği opsiyonel ID alanı
  full_name: string;
  position_title: string;
  branch_id: string;
}) {
  const supabase = await createClient();
  let finalId = formData.id?.trim();

  // 1. EĞER DIŞARIDAN ÖZEL BİR ID GELMEDİYSE: Eski mantıkla rastgele ve benzersiz 5 haneli ID üret
  if (!finalId) {
    let isUnique = false;
    while (!isUnique) {
      finalId = Math.floor(10000 + Math.random() * 90000).toString();
      const { data } = await supabase.from('employees').select('id').eq('id', finalId).single();
      if (!data) isUnique = true;
    }
  } 
  // 2. EĞER DIŞARIDAN ÖZEL ID GELDİYSE: Veritabanında çakışma (aynı ID var mı) kontrolü yap
  else {
    const { data } = await supabase.from('employees').select('id').eq('id', finalId).single();
    if (data) {
      throw new Error('Güvenlik İhlali: Girdiğiniz özel Terminal ID sistemi tarafından zaten kullanılıyor.');
    }
  }

  // 3. Nihai ID (Rastgele veya Özel) ile veritabanına kayıt işlemi
  const { data: newEmployee, error } = await supabase
    .from('employees')
    .insert([
      {
        id: finalId,
        full_name: formData.full_name,
        position_title: formData.position_title,
        branch_id: formData.branch_id,
        is_active: true,
      },
    ])
    .select('*, branches(name)')
    .single();

  if (error) throw new Error('Personel oluşturulamadı: ' + error.message);

  revalidatePath('/management/hr/personnel');
  return newEmployee;
}

export async function deleteEmployee(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('employees').delete().eq('id', id);

  if (error) {
    throw new Error('Personel silinemedi (Sistemde hareket görmüş olabilir): ' + error.message);
  }

  revalidatePath('/management/hr/personnel');
}