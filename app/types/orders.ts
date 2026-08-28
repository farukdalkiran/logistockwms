// types/orders.ts

export type OrderType = 'COMMERCIAL' | 'CONSUMABLE';
export type OrderStatus = 'PENDING' | 'PARTIALLY_APPROVED' | 'APPROVED' | 'REJECTED' | 'PICKING' | 'SHIPPED' | 'DELIVERED';

export interface Order {
  id: string;
  order_number: string; // Örn: ORD-20260825-101
  branch_id: string; // Siparişi veren mağaza/şube
  order_type: OrderType;
  status: OrderStatus;
  created_by: string; // Siparişi giren employee_id
  created_at: string;
  updated_at: string;
  rejection_reason?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  requested_qty: number; // Mağazanın istediği
  approved_qty: number;  // Merkez deponun onayladığı (Revize edilebilir)
  sent_qty: number;      // Depodan okutularak çıkan
  received_qty: number;  // Mağazaya ulaştığında okutulan
}

// Frontend Sepet (Cart) State Tipi
export interface CartItem {
  product_id: string;
  sku: string;
  name: string;
  image_url: string | null;
  quantity: number;
}