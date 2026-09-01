// Sincronizacion y analitica de productos vendidos/inventario CPI. Solo servidor.
import { createAdminClient } from "@/lib/supabase";
import {
  cpiGetInventoryItems,
  cpiGetSoldProductsForDays,
  normalizeName,
  type CpiInventoryItem,
  type CpiSoldProduct,
} from "@/lib/cpi";
import {
  isMissingStockStatusError,
  normalizeStockStatus,
  readStockStatusAttribute,
  writeStockStatusAttribute,
  type StockStatus,
} from "@/lib/stock";
import { isUSDCurrency } from "@/lib/utils";

const PRODUCT_SALES_TABLE = "cpi_product_sales_daily";

type ProductSaleDbRow = {
  cpi_key: string;
  sale_date: string;
  sku: string;
  descripcion: string;
  moneda: string;
  cantidad: number;
  total_venta: number;
  costo_venta: number;
  utilidad: number;
  stock_qty: number | null;
  synced_at?: string;
};

type CatalogProduct = {
  id: string;
  sku: string | null;
  name: string;
  stock_qty: number | null;
  in_stock: boolean;
  stock_status?: string | null;
  attributes?: Record<string, unknown> | null;
};

export type ProductSalesSyncResult = {
  from: string;
  to: string;
  days: number;
  products: number;
};

export type TopSoldProduct = {
  sku: string;
  descripcion: string;
  cantidad: number;
  crc: number;
  usd: number;
  saleDays: number;
};

export type ProductSalesAnalytics = {
  productCount: number;
  totalUnits: number;
  totalCRC: number;
  totalUSD: number;
  topProducts: TopSoldProduct[];
  hasData: boolean;
};

export type InventorySyncResult = {
  fetched: number;
  catalogProducts: number;
  matched: number;
  matchedBySku: number;
  matchedByName: number;
  updated: number;
  unchanged: number;
  ambiguous: number;
  unmatched: number;
  coveragePct: number;
  unmatchedExamples: { sku: string; name: string }[];
};

function crToday(ref = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
}

function addDays(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}

function daysInRange(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("El rango de productos vendidos debe usar fechas YYYY-MM-DD");
  }
  if (from > to) throw new Error("La fecha inicial no puede ser posterior a la final");
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  if (days.length > 62) throw new Error("El rango maximo para sincronizar productos es de 62 dias");
  return days;
}

function missingProductSalesTable(error: unknown): boolean {
  const text =
    typeof error === "object" && error !== null
      ? JSON.stringify(error).toLowerCase()
      : String(error ?? "").toLowerCase();
  return text.includes(PRODUCT_SALES_TABLE) && /relation|schema cache|does not exist|pgrst205/.test(text);
}

function productSalesTableError(error: unknown): Error {
  if (missingProductSalesTable(error)) {
    return new Error(
      "Falta la tabla de productos vendidos. Ejecuta supabase/cpi_product_sales.sql en Supabase."
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

function productKey(sku: string, description: string): string {
  return normalizeName(sku || description).slice(0, 180);
}

function mergeSoldProducts(products: CpiSoldProduct[]): CpiSoldProduct[] {
  const merged = new Map<string, CpiSoldProduct>();
  for (const product of products) {
    const key = `${product.moneda}|${productKey(product.sku, product.descripcion)}`;
    if (!key.split("|")[1]) continue;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...product });
      continue;
    }
    current.cantidad += product.cantidad;
    current.totalVenta += product.totalVenta;
    current.costoVenta += product.costoVenta;
    current.utilidad += product.utilidad;
    current.stockQty = product.stockQty;
  }
  return [...merged.values()];
}

async function smartSalesRange(): Promise<{ from: string; to: string }> {
  const today = crToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const sb = createAdminClient();
  const { data, error } = await sb
    .from(PRODUCT_SALES_TABLE)
    .select("sale_date")
    .gte("sale_date", monthStart)
    .lte("sale_date", today)
    .order("sale_date", { ascending: false })
    .limit(1);
  if (error) throw productSalesTableError(error);
  const latest = (data?.[0] as { sale_date?: string } | undefined)?.sale_date?.slice(0, 10);
  return { from: latest || monthStart, to: today };
}

/**
 * Guarda agregados diarios de productos vendidos. Sin rango explicito, completa
 * los dias faltantes del mes y vuelve a refrescar el dia actual.
 */
export async function syncCpiProductSales(
  opts: { from?: string; to?: string } = {}
): Promise<ProductSalesSyncResult> {
  const range =
    opts.from || opts.to
      ? { from: (opts.from || opts.to)!.slice(0, 10), to: (opts.to || opts.from)!.slice(0, 10) }
      : await smartSalesRange();
  const days = daysInRange(range.from, range.to);
  const daily = await cpiGetSoldProductsForDays(days);
  const sb = createAdminClient();
  let productCount = 0;

  for (const item of daily) {
    const products = mergeSoldProducts(item.products);
    productCount += products.length;
    const syncedAt = new Date().toISOString();
    const rows: ProductSaleDbRow[] = products.map((product) => ({
      cpi_key: `${item.day}|${product.moneda}|${productKey(product.sku, product.descripcion)}`,
      sale_date: item.day,
      sku: product.sku,
      descripcion: product.descripcion,
      moneda: product.moneda,
      cantidad: product.cantidad,
      total_venta: product.totalVenta,
      costo_venta: product.costoVenta,
      utilidad: product.utilidad,
      stock_qty: product.stockQty,
      synced_at: syncedAt,
    }));
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await sb
        .from(PRODUCT_SALES_TABLE)
        .upsert(rows.slice(i, i + 400), { onConflict: "cpi_key" });
      if (error) throw productSalesTableError(error);
    }

    // Guardamos primero y solo despues limpiamos claves que ya no aparecen.
    // Una interrupcion durante el upsert no puede dejar el panel vacio.
    const { data: existing, error: existingError } = await sb
      .from(PRODUCT_SALES_TABLE)
      .select("cpi_key")
      .eq("sale_date", item.day);
    if (existingError) throw productSalesTableError(existingError);
    const currentKeys = new Set(rows.map((row) => row.cpi_key));
    const staleKeys = (existing ?? [])
      .map((row: { cpi_key: string }) => row.cpi_key)
      .filter((key: string) => !currentKeys.has(key));
    for (let i = 0; i < staleKeys.length; i += 200) {
      const { error: deleteError } = await sb
        .from(PRODUCT_SALES_TABLE)
        .delete()
        .in("cpi_key", staleKeys.slice(i, i + 200));
      if (deleteError) throw productSalesTableError(deleteError);
    }
  }

  return {
    from: range.from,
    to: range.to,
    days: daily.length,
    products: productCount,
  };
}

export async function getProductSalesAnalytics(range: {
  from: string;
  to: string;
}): Promise<ProductSalesAnalytics> {
  const empty: ProductSalesAnalytics = {
    productCount: 0,
    totalUnits: 0,
    totalCRC: 0,
    totalUSD: 0,
    topProducts: [],
    hasData: false,
  };
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from(PRODUCT_SALES_TABLE)
      .select("sale_date, sku, descripcion, moneda, cantidad, total_venta")
      .gte("sale_date", range.from.slice(0, 10))
      .lt("sale_date", range.to.slice(0, 10))
      .limit(50000);
    if (error) return empty;

    type Agg = TopSoldProduct & { days: Set<string> };
    const products = new Map<string, Agg>();
    let totalUnits = 0;
    let totalCRC = 0;
    let totalUSD = 0;
    for (const row of (data ?? []) as (ProductSaleDbRow & { sale_date: string })[]) {
      const key = productKey(row.sku, row.descripcion);
      if (!key) continue;
      const amount = Number(row.total_venta) || 0;
      const quantity = Number(row.cantidad) || 0;
      const agg =
        products.get(key) ??
        {
          sku: row.sku || "",
          descripcion: row.descripcion || row.sku || "Producto",
          cantidad: 0,
          crc: 0,
          usd: 0,
          saleDays: 0,
          days: new Set<string>(),
        };
      agg.cantidad += quantity;
      if (isUSDCurrency(row.moneda)) agg.usd += amount;
      else agg.crc += amount;
      agg.days.add(row.sale_date);
      products.set(key, agg);
      totalUnits += quantity;
      if (isUSDCurrency(row.moneda)) totalUSD += amount;
      else totalCRC += amount;
    }

    const topProducts = [...products.values()]
      .map(({ days, ...product }) => ({ ...product, saleDays: days.size }))
      .sort((a, b) => b.cantidad - a.cantidad || b.crc - a.crc || b.usd - a.usd)
      .slice(0, 20);
    return {
      productCount: products.size,
      totalUnits,
      totalCRC,
      totalUSD,
      topProducts,
      hasData: products.size > 0,
    };
  } catch {
    return empty;
  }
}

function normalizeSku(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

function uniqueMap<T>(items: T[], keyFor: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

async function fetchCatalogProducts(): Promise<{
  products: CatalogProduct[];
  hasStockStatus: boolean;
}> {
  const sb = createAdminClient();
  const withStatus = "id, sku, name, stock_qty, in_stock, stock_status, attributes";
  const legacy = "id, sku, name, stock_qty, in_stock, attributes";
  let hasStockStatus = true;
  const products: CatalogProduct[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await sb
      .from("products")
      .select(withStatus)
      .range(from, from + 999);
    let page: CatalogProduct[];
    if (result.error && isMissingStockStatusError(result.error)) {
      hasStockStatus = false;
      const legacyResult = await sb
        .from("products")
        .select(legacy)
        .range(from, from + 999);
      if (legacyResult.error) throw legacyResult.error;
      page = (legacyResult.data ?? []) as CatalogProduct[];
    } else {
      if (result.error) throw result.error;
      page = (result.data ?? []) as CatalogProduct[];
    }
    products.push(...page);
    if (page.length < 1000) break;
  }
  return { products, hasStockStatus };
}

async function mapConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}

/** Sincroniza cantidades y disponibilidad del catalogo con el inventario CPI. */
export async function syncCpiInventory(): Promise<InventorySyncResult> {
  const [inventory, catalog] = await Promise.all([
    cpiGetInventoryItems(),
    fetchCatalogProducts(),
  ]);
  const webBySku = uniqueMap(catalog.products, (product) => normalizeSku(product.sku || ""));
  const webByName = uniqueMap(catalog.products, (product) => normalizeName(product.name));
  const cpiBySku = uniqueMap(inventory, (item) => normalizeSku(item.sku));
  const cpiByName = uniqueMap(inventory, (item) => normalizeName(item.descripcion));

  type Update = {
    product: CatalogProduct;
    item: CpiInventoryItem;
    qty: number;
    status: StockStatus;
  };
  const updates: Update[] = [];
  const unmatchedExamples: { sku: string; name: string }[] = [];
  let matchedBySku = 0;
  let matchedByName = 0;
  let unchanged = 0;
  let ambiguous = 0;
  let unmatched = 0;

  for (const product of catalog.products) {
    const sku = normalizeSku(product.sku || "");
    const name = normalizeName(product.name);
    let match: CpiInventoryItem | undefined;
    let matchedWith: "sku" | "name" | null = null;
    if (sku && webBySku.get(sku)?.length === 1 && cpiBySku.get(sku)?.length === 1) {
      match = cpiBySku.get(sku)![0];
      matchedWith = "sku";
    } else if (
      name &&
      webByName.get(name)?.length === 1 &&
      cpiByName.get(name)?.length === 1
    ) {
      match = cpiByName.get(name)![0];
      matchedWith = "name";
    }

    if (!match) {
      const isAmbiguous =
        (sku && ((webBySku.get(sku)?.length ?? 0) > 1 || (cpiBySku.get(sku)?.length ?? 0) > 1)) ||
        (name &&
          ((webByName.get(name)?.length ?? 0) > 1 || (cpiByName.get(name)?.length ?? 0) > 1));
      if (isAmbiguous) ambiguous += 1;
      else unmatched += 1;
      if (unmatchedExamples.length < 10) {
        unmatchedExamples.push({ sku: product.sku || "", name: product.name });
      }
      continue;
    }

    if (matchedWith === "sku") matchedBySku += 1;
    else matchedByName += 1;
    const qty = Math.max(0, Number(match.stockQty) || 0);
    const status: StockStatus = qty > 0 ? "in_stock" : "out_of_stock";
    const currentStatus = normalizeStockStatus(
      product.stock_status ?? readStockStatusAttribute(product.attributes),
      product.in_stock
    );
    if (
      typeof product.stock_qty === "number" &&
      product.stock_qty === qty &&
      currentStatus === status
    ) {
      unchanged += 1;
      continue;
    }
    updates.push({ product, item: match, qty, status });
  }

  const sb = createAdminClient();
  await mapConcurrent(updates, 10, async ({ product, qty, status }) => {
    const row: Record<string, unknown> = {
      stock_qty: qty,
      in_stock: status !== "out_of_stock",
      attributes: writeStockStatusAttribute(product.attributes, status),
      updated_at: new Date().toISOString(),
    };
    if (catalog.hasStockStatus) row.stock_status = status;
    const { error } = await sb.from("products").update(row).eq("id", product.id);
    if (error) throw error;
  });

  const matched = matchedBySku + matchedByName;
  return {
    fetched: inventory.length,
    catalogProducts: catalog.products.length,
    matched,
    matchedBySku,
    matchedByName,
    updated: updates.length,
    unchanged,
    ambiguous,
    unmatched,
    coveragePct: catalog.products.length
      ? Math.round((matched / catalog.products.length) * 1000) / 10
      : 0,
    unmatchedExamples,
  };
}

export type ProductRankRow = {
  rank: number;
  sku: string;
  descripcion: string;
  cantidad: number;
  crc: number;
  usd: number;
  saleDays: number;
  lastSale: string | null;
};

export type BranchProductRanking = {
  sucursal: string;
  rows: ProductRankRow[];
};

/** Ranking historico (acumulado desde siempre) de TODOS los productos facturados.
 *  Sin limite: si un producto se facturo una sola vez, igual aparece. */
export async function getAllTimeProductRanking(): Promise<ProductRankRow[]> {
  // El ranking lo agrega Postgres (funcion cpi_product_ranking). Antes se
  // recorria toda la tabla pagina por pagina en cada visita -> mucho egress.
  try {
    const sb = createAdminClient();
    const { data, error } = await sb.rpc("cpi_product_ranking");
    if (error || !data) return [];
    type Rpc = {
      sku: string;
      descripcion: string;
      cantidad: number;
      crc: number;
      usd: number;
      sale_days: number;
      last_sale: string | null;
    };
    return (data as Rpc[]).map((r, i) => ({
      rank: i + 1,
      sku: r.sku || "",
      descripcion: r.descripcion || r.sku || "Producto",
      cantidad: Number(r.cantidad) || 0,
      crc: Number(r.crc) || 0,
      usd: Number(r.usd) || 0,
      saleDays: Number(r.sale_days) || 0,
      lastSale: r.last_sale,
    }));
  } catch {
    return [];
  }
}

/** Top de productos por sucursal, calculado sobre las líneas de factura CPI. */
export async function getBranchProductRankings(limit = 40): Promise<BranchProductRanking[]> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb.rpc("cpi_branch_product_ranking", {
      p_limit: Math.max(1, Math.min(Math.floor(limit), 100)),
    });
    if (error || !data) return [];
    type Rpc = {
      sucursal: string;
      product_rank: number;
      sku: string;
      descripcion: string;
      cantidad: number;
      crc: number;
      usd: number;
      sale_days: number;
      last_sale: string | null;
    };
    const byBranch = new Map<string, ProductRankRow[]>();
    for (const row of data as Rpc[]) {
      const sucursal = row.sucursal || "Sin sucursal";
      const rows = byBranch.get(sucursal) ?? [];
      rows.push({
        rank: Number(row.product_rank) || rows.length + 1,
        sku: row.sku || "",
        descripcion: row.descripcion || row.sku || "Producto",
        cantidad: Number(row.cantidad) || 0,
        crc: Number(row.crc) || 0,
        usd: Number(row.usd) || 0,
        saleDays: Number(row.sale_days) || 0,
        lastSale: row.last_sale,
      });
      byBranch.set(sucursal, rows);
    }
    return [...byBranch.entries()].map(([sucursal, rows]) => ({ sucursal, rows }));
  } catch {
    return [];
  }
}
