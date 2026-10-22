"use server";

import {
  getInventoryProductDetailServer,
  getInventorySnapshotServer,
} from "./inventory-queries";
import { filterInventory } from "@/lib/inventory-data";

// Compatibility for existing callers. Global/branch parameters cannot override the session branch.
export async function getAggregatedInventoryServer(
  searchTerm: string,
  _branchId: string | null,
  _isGlobal: boolean,
) {
  const snapshot = await getInventorySnapshotServer();
  return filterInventory(snapshot.products, {
    product: searchTerm,
    shelf: "",
    kind: "ALL",
    status: "ALL",
    category: "ALL",
    sort: "STOCK_DESC",
  });
}
export async function getStockHistoryModalDataServer(
  productId: string,
  _branchId: string | null,
  _isGlobal: boolean,
  _searchKeyword: string,
) {
  const detail = await getInventoryProductDetailServer(productId);
  return {
    shelves: detail.product.shelves.map((shelf) => ({
      shelf_location: shelf.name,
      shelf_id: shelf.shelf_id,
      status: shelf.status,
      quantity: shelf.quantity,
    })),
    logs: detail.logs.map((log) => ({
      ...log,
      employees: { full_name: log.employee_name },
    })),
    product: detail.product,
  };
}
