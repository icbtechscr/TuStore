import "server-only";

import { unstable_cache } from "next/cache";
import { normalizeName } from "@/lib/cpi";
import { createAdminClient } from "@/lib/supabase";

export const ROTATION_PERIODS = [30, 60, 90] as const;
export type RotationPeriod = (typeof ROTATION_PERIODS)[number];
export type RotationStatus = "no_movement" | "low" | "normal";
export type RotationFilter = "attention" | RotationStatus | "all";

type InventoryDbRow = {
  cpi_key: string;
  sucursal: string;
  sku: string;
  descripcion: string;
  stock_qty: number;
  synced_at: string;
};

type SaleDbRow = {
  cpi_key: string;
  sale_date: string;
  origen: string;
  sku: string;
  descripcion: string;
  cantidad: number;
};

type SaleAggregate = {
  units: number;
  saleDays: Set<string>;
  lastSale: string | null;
};

export type InventoryRotationRow = {
  branch: string;
  sku: string;
  description: string;
  stockQty: number;
  soldUnits: number;
  saleDays: number;
  lastSale: string | null;
  daysWithoutSale: number;
  coverageDays: number | null;
  status: RotationStatus;
};

export type InventoryRotationSummary = {
  branch: string;
  productsWithStock: number;
  noMovement: number;
  lowRotation: number;
  normalRotation: number;
  unitsWithoutMovement: number;
};

export type InventoryRotationReport = {
  requestedDays: RotationPeriod;
  trackedDays: number;
  from: string;
  to: string;
  firstSaleDate: string | null;
  inventorySyncedAt: string | null;
  branches: string[];
  rows: InventoryRotationRow[];
  summaries: InventoryRotationSummary[];
};

export function parseRotationPeriod(value: unknown): RotationPeriod {
  const parsed = Number(value);
  return ROTATION_PERIODS.includes(parsed as RotationPeriod)
    ? (parsed as RotationPeriod)
    : 30;
}

export function parseRotationFilter(value: unknown): RotationFilter {
  return value === "all" ||
    value === "attention" ||
    value === "no_movement" ||
    value === "low" ||
    value === "normal"
    ? value
    : "attention";
}

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

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  aacute_upper: "Á",
  eacute_upper: "É",
  iacute_upper: "Í",
  oacute_upper: "Ó",
  uacute_upper: "Ú",
  ntilde_upper: "Ñ",
  uuml_upper: "Ü",
};

function decodeCpiText(value: string): string {
  return value.replace(
    /&#(\d+);|&#x([0-9a-f]+);|&([a-z]+);/gi,
    (entity, decimal: string | undefined, hex: string | undefined, named: string | undefined) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      if (!named) return entity;
      const exactKey = /^[A-Z]/.test(named)
        ? `${named.toLowerCase()}_upper`
        : named.toLowerCase();
      return HTML_ENTITIES[exactKey] ?? HTML_ENTITIES[named.toLowerCase()] ?? entity;
    }
  );
}

function productKey(value: string): string {
  return normalizeName(decodeCpiText(value)).slice(0, 220);
}

function branchKey(value: string): string {
  return normalizeName(value || "Sin sucursal");
}

function saleMapKey(branch: string, product: string): string {
  return `${branchKey(branch)}|${productKey(product)}`;
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchInventoryRows(): Promise<InventoryDbRow[]> {
  const sb = createAdminClient();
  const rows: InventoryDbRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("cpi_inventory")
      .select("cpi_key, sucursal, sku, descripcion, stock_qty, synced_at")
      .gt("stock_qty", 0)
      .order("cpi_key")
      .range(from, from + 999);
    if (error) throw error;
    const page = (data ?? []) as InventoryDbRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function fetchSalesRows(fromDay: string, toDay: string): Promise<SaleDbRow[]> {
  const sb = createAdminClient();
  const rows: SaleDbRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("cpi_product_sales_branch_daily")
      .select("cpi_key, sale_date, origen, sku, descripcion, cantidad")
      .gte("sale_date", fromDay)
      .lte("sale_date", toDay)
      .order("cpi_key")
      .range(from, from + 999);
    if (error) throw error;
    const page = (data ?? []) as SaleDbRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function firstRecordedSaleDate(): Promise<string | null> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("cpi_product_sales_branch_daily")
    .select("sale_date")
    .order("sale_date", { ascending: true })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as { sale_date?: string } | undefined)?.sale_date?.slice(0, 10) ?? null;
}

function addSale(
  map: Map<string, SaleAggregate>,
  key: string,
  row: SaleDbRow,
  units: number
) {
  if (!key) return;
  const aggregate = map.get(key) ?? {
    units: 0,
    saleDays: new Set<string>(),
    lastSale: null,
  };
  aggregate.units += units;
  aggregate.saleDays.add(row.sale_date);
  if (!aggregate.lastSale || row.sale_date > aggregate.lastSale) {
    aggregate.lastSale = row.sale_date;
  }
  map.set(key, aggregate);
}

function summarize(branch: string, rows: InventoryRotationRow[]): InventoryRotationSummary {
  return {
    branch,
    productsWithStock: rows.length,
    noMovement: rows.filter((row) => row.status === "no_movement").length,
    lowRotation: rows.filter((row) => row.status === "low").length,
    normalRotation: rows.filter((row) => row.status === "normal").length,
    unitsWithoutMovement: roundQuantity(
      rows
        .filter((row) => row.status === "no_movement")
        .reduce((sum, row) => sum + row.stockQty, 0)
    ),
  };
}

async function loadInventoryRotationReport(
  requestedDays: RotationPeriod
): Promise<InventoryRotationReport> {
  const to = crToday();
  const requestedFrom = addDays(to, -(requestedDays - 1));
  const [inventoryRows, firstSaleDate] = await Promise.all([
    fetchInventoryRows(),
    firstRecordedSaleDate(),
  ]);
  const from = firstSaleDate && firstSaleDate > requestedFrom ? firstSaleDate : requestedFrom;
  const trackedDays = Math.max(1, daysBetween(from, to) + 1);
  const salesRows = await fetchSalesRows(from, to);

  const salesBySku = new Map<string, SaleAggregate>();
  const salesByDescription = new Map<string, SaleAggregate>();
  for (const row of salesRows) {
    const units = Math.max(0, Number(row.cantidad) || 0);
    if (units <= 0) continue;
    if (row.sku.trim()) {
      addSale(salesBySku, saleMapKey(row.origen, row.sku), row, units);
    }
    if (row.descripcion.trim()) {
      addSale(
        salesByDescription,
        saleMapKey(row.origen, row.descripcion),
        row,
        units
      );
    }
  }

  const rows = inventoryRows.map<InventoryRotationRow>((inventory) => {
    const branch = inventory.sucursal.trim() || "Sin sucursal";
    const sale =
      (inventory.sku.trim()
        ? salesBySku.get(saleMapKey(branch, inventory.sku))
        : undefined) ??
      salesByDescription.get(saleMapKey(branch, inventory.descripcion));
    const soldUnits = roundQuantity(Math.max(0, sale?.units ?? 0));
    const stockQty = roundQuantity(Math.max(0, Number(inventory.stock_qty) || 0));
    const lastSale = sale?.lastSale ?? null;
    const status: RotationStatus =
      soldUnits <= 0 ? "no_movement" : soldUnits <= 2 ? "low" : "normal";
    return {
      branch,
      sku: inventory.sku.trim(),
      description:
        decodeCpiText(inventory.descripcion).trim() || inventory.sku.trim() || "Producto",
      stockQty,
      soldUnits,
      saleDays: sale?.saleDays.size ?? 0,
      lastSale,
      daysWithoutSale: lastSale ? daysBetween(lastSale, to) : trackedDays,
      coverageDays:
        soldUnits > 0 ? Math.max(1, Math.round((stockQty / soldUnits) * trackedDays)) : null,
      status,
    };
  });

  const statusOrder: Record<RotationStatus, number> = {
    no_movement: 0,
    low: 1,
    normal: 2,
  };
  rows.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      b.stockQty - a.stockQty ||
      a.soldUnits - b.soldUnits ||
      a.description.localeCompare(b.description, "es")
  );

  const branches = [...new Set(rows.map((row) => row.branch))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
  const summaries = branches.map((branch) =>
    summarize(
      branch,
      rows.filter((row) => row.branch === branch)
    )
  );
  const inventorySyncedAt =
    inventoryRows
      .map((row) => row.synced_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

  return {
    requestedDays,
    trackedDays,
    from,
    to,
    firstSaleDate,
    inventorySyncedAt,
    branches,
    rows,
    summaries,
  };
}

const getCachedInventoryRotationReport = unstable_cache(
  loadInventoryRotationReport,
  ["cpi-inventory-rotation-v2"],
  { revalidate: 300 }
);

export async function getInventoryRotationReport(
  days: RotationPeriod
): Promise<InventoryRotationReport> {
  return getCachedInventoryRotationReport(parseRotationPeriod(days));
}

export function filterInventoryRotationRows(
  report: InventoryRotationReport,
  filters: { branch?: string | null; status?: RotationFilter; query?: string | null }
): InventoryRotationRow[] {
  const branch = filters.branch?.trim() || "";
  const status = parseRotationFilter(filters.status);
  const query = normalizeName(filters.query?.slice(0, 120) || "");
  return report.rows.filter((row) => {
    if (branch && row.branch !== branch) return false;
    if (status === "attention" && row.status === "normal") return false;
    if (status !== "all" && status !== "attention" && row.status !== status) return false;
    if (
      query &&
      !normalizeName(`${row.sku} ${row.description} ${row.branch}`).includes(query)
    ) {
      return false;
    }
    return true;
  });
}
