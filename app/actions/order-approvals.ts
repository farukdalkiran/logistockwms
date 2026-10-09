'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function processOrderApproval(formData: FormData) {
  const db = await createClient();
  const { data: session } = await db.auth.getUser();
  if (!session.user) return { success: false, error: 'Oturum bulunamadı.' };

  const orderId = String(formData.get('order_id'));
  const warehouseId = String(formData.get('warehouse_id'));
  const isApproveAll = formData.get('intent') === 'approve_all';

  try {
    // 1. Siparişin mevcut durumunu çek
    const { data: order, error: orderError } = await db
      .from('orders')
      .select('status, order_items(id, product_id, requested_qty)')
      .eq('id', orderId)
      .single();

    if (orderError || order.status !== 'PENDING') {
      throw new Error('Sipariş bulunamadı veya işlem yetkiniz yok (Zaten onaylanmış olabilir).');
    }

    const items = order.order_items || [];
    let totalApproved = 0;
    const updates = [];

    // 2. Her bir kalem için kararları topla
    for (const item of items) {
      const mode = isApproveAll ? 'APPROVE' : String(formData.get(`decision_${item.id}`));
      let approvedQty = 0;
      let revisionReason = null;

      if (mode === 'APPROVE') {
        approvedQty = item.requested_qty;
      } else if (mode === 'REVISE') {
        approvedQty = Number(formData.get(`qty_${item.id}`));
        const reason = String(formData.get(`reason_${item.id}`));
        const note = String(formData.get(`note_${item.id}`));
        revisionReason = note ? `${reason} — ${note}` : reason;
        
        if (approvedQty >= item.requested_qty || approvedQty < 1) {
            throw new Error('Revize adedi hatalı. (1 ile talep edilen miktar arasında olmalı)');
        }
      } else if (mode === 'REMOVE') {
        approvedQty = 0;
        const reason = String(formData.get(`reason_${item.id}`));
        const note = String(formData.get(`note_${item.id}`));
        revisionReason = note ? `${reason} — ${note}` : reason;
      }

      totalApproved += approvedQty;

      updates.push({
        id: item.id,
        order_id: orderId,
        product_id: item.product_id,
        requested_qty: item.requested_qty,
        approved_qty: approvedQty,
        revision_reason: revisionReason
      });
    }

    // 3. Stok Kontrolü (Eğer onaylanan miktar varsa, depodaki stok yetiyor mu?)
    // Not: Bu aşamada sadece kontrol yapıyoruz, stoktan düşme işlemi "Toplama/Transfer" aşamasında yapılacak.
    // Ancak depoda olmayan malı onaylatmamak için burada bir kontrol bloku eklenebilir.

    // 4. Veritabanına Kalemleri Kaydet
    const { error: itemsError } = await db.from('order_items').upsert(updates);
    if (itemsError) throw itemsError;

    // 5. Sipariş Ana Durumunu Güncelle
    const finalStatus = totalApproved === 0 ? 'REJECTED' : 
                       (totalApproved === items.reduce((sum, i) => sum + i.requested_qty, 0) ? 'APPROVED' : 'PARTIALLY_APPROVED');

    const { error: updateOrderError } = await db
      .from('orders')
      .update({ status: finalStatus })
      .eq('id', orderId);

    if (updateOrderError) throw updateOrderError;

    revalidatePath('/management/orders/store-orders');
    return { success: true, message: `Sipariş başarıyla işlendi. Yeni Durum: ${finalStatus}` };

  } catch (error: any) {
    return { success: false, error: error.message || 'İşlem sırasında bir hata oluştu.' };
  }
}