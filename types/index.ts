// types/index.ts

export type Role = "Admin" | "Developer" | "Sube_Yoneticisi";
export type BranchType = "Depo" | "Mağaza";
export type TransferStatus =
  | "pending"
  | "picking"
  | "in_transit"
  | "completed"
  | "cancelled";

export interface Branch {
  id: string;
  name: string;
  type: BranchType;
}

export interface Profile {
  id: string; // auth.users.id ile eşleşir
  branch_id?: string | null;
  role: Role;
  last_password_change: string;
}

export interface Employee {
  id: string; // 5 haneli (Örn: 19054, 39760)
  full_name: string;
  position_title: string;
  branch_id: string;
  birthday: string | null;
  employment_date: string;
  photo_url: string | null;
  is_active: boolean;
}

export interface ShiftAttendance {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: "onTime" | "late" | "absent" | "excused";
  manager_id: string | null; // Manuel düzeltme yapan yöneticinin ID'si
}

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  category: string;
  is_consumable: boolean;
  max_order_limit: number;
  image_url: string | null;
}

export interface Stock {
  id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  shelf_location: string;
  last_activity_at: string;
}

export interface Transfer {
  id: string;
  transfer_code: string; // Örn: LS1015
  from_branch_id: string;
  to_branch_id: string;
  carrier_id: string | null;
  status: TransferStatus;
  tracking_barcode: string | null;
  picker_employee_id: string | null; // Smart Picking'i yapan personel
  created_at: string;
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  requested_qty: number;
  approved_qty: number;
  sent_qty: number;
  received_qty: number;
  products?: Product; // Join işlemleri için
  stocks?: Stock[]; // Raf sırasına göre dizmek için join
}

export interface TransactionLog {
  id: string;
  employee_id: string; // İşlemi yapan 5 haneli ID
  action_type:
    | "check_in"
    | "check_out"
    | "pick_item"
    | "receive_item"
    | "manual_override"
    | "stock_update";
  description: string;
  created_at: string;
}
