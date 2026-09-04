export const STOCK_STATUSES = ["in_stock", "backorder", "out_of_stock"] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: "En stock",
  backorder: "Contrapedido",
  out_of_stock: "Agotado",
};

export const STOCK_STATUS_ATTRIBUTE = "icb_stock_status";

export function normalizeStockStatus(
  value: string | null | undefined,
  legacyInStock = true
): StockStatus {
  if (value === "in_stock" || value === "backorder" || value === "out_of_stock") {
    return value;
  }
  return legacyInStock ? "in_stock" : "out_of_stock";
}

export function readStockStatusAttribute(attributes: unknown): StockStatus | null {
  if (!attributes || typeof attributes !== "object") return null;
  const value = (attributes as Record<string, unknown>)[STOCK_STATUS_ATTRIBUTE];
  return typeof value === "string" &&
    (value === "in_stock" || value === "backorder" || value === "out_of_stock")
    ? value
    : null;
}

export function writeStockStatusAttribute(
  attributes: unknown,
  status: StockStatus
): Record<string, unknown> {
  const current =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? { ...(attributes as Record<string, unknown>) }
      : {};
  current[STOCK_STATUS_ATTRIBUTE] = status;
  return current;
}

export function stockStatusToLegacyInStock(status: StockStatus): boolean {
  return status !== "out_of_stock";
}

export function stockOrderLimit(
  status: StockStatus,
  stockQty: number | null | undefined
): number | null {
  if (status === "out_of_stock") return 0;
  if (status === "backorder") return null;
  if (typeof stockQty !== "number" || !Number.isFinite(stockQty)) return null;
  return Math.max(0, Math.floor(stockQty));
}

export function clampOrderQty(
  qty: number,
  status: StockStatus,
  stockQty: number | null | undefined
): number {
  const normalizedQty = Math.max(1, Math.floor(qty));
  const limit = stockOrderLimit(status, stockQty);
  return limit === null ? normalizedQty : Math.min(normalizedQty, limit);
}

export function effectiveStockStatus(
  status: StockStatus,
  stockQty: number | null | undefined
): StockStatus {
  return stockOrderLimit(status, stockQty) === 0 ? "out_of_stock" : status;
}

export function isPurchasableStock(
  status: StockStatus,
  stockQty: number | null | undefined
): boolean {
  return status === "in_stock" && stockOrderLimit(status, stockQty) !== 0;
}

export function isPurchasableProduct(
  status: StockStatus,
  stockQty: number | null | undefined,
  unitPrice: number
): boolean {
  return (
    isPurchasableStock(status, stockQty) &&
    Number.isFinite(unitPrice) &&
    unitPrice > 0
  );
}

export function isMissingStockStatusError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown; details?: unknown };
  const text = [record.code, record.message, record.details]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  return text.includes("stock_status") && text.includes("products");
}
