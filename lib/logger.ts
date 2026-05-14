// lib/logger.ts
import { supabase } from './supabase';
import { TransactionLog } from '@/types';

/**
 * LogiStock Merkezi İşlem Kayıt Motoru
 * Bu fonksiyon, sistemdeki tüm fiziksel ve manuel hareketleri veritabanına mühürler.
 * @param employeeId İşlemi yapan personelin 5 haneli ID'si (Örn: 39760)
 * @param actionType İşlemin kategorisi
 * @param description İşlemin detaylı insan okuyabilir açıklaması
 */
export const logTransaction = async (
  employeeId: string,
  actionType: TransactionLog['action_type'],
  description: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('transaction_logs')
      .insert([
        {
          employee_id: employeeId,
          action_type: actionType,
          description: description,
        }
      ]);

    if (error) {
      // Kritik uyarı: Gerçek bir senaryoda bu hatalar Sentry veya Datadog gibi bir servise yollanabilir.
      console.error("[LOGISTOCK KRTİK HATA] Transaction loglanamadı:", error.message);
    }
  } catch (err) {
    console.error("[LOGISTOCK KRTİK HATA] Log motoru çöktü:", err);
  }
};