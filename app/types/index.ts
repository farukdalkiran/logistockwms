// Mevcut tiplerinin altına eklenecekler:

export type OrderType = 'COMMERCIAL' | 'CONSUMABLE';
export type OrderStatus = 'PENDING' | 'PARTIALLY_APPROVED' | 'APPROVED' | 'REJECTED' | 'PICKING' | 'SHIPPED' | 'DELIVERED';

export interface Order {
  id: string;
  order_number: string;
  branch_id: string;
  order_type: OrderType;
  status: OrderStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  requested_qty: number;
  approved_qty: number;
  sent_qty: number;
  received_qty: number;
}

// Sipariş Sepeti için Frontend Tipi
export interface CartItem {
  product_id: string;
  sku: string;
  name: string;
  image_url: string | null;
  quantity: number;
}