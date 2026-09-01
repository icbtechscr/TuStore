// Capa de servidor para ventas CPI: sincronizacion (upsert + mapeo vendedor->
// usuario) y consultas de metricas. SOLO servidor (usa el admin client).
import { createAdminClient } from "@/lib/supabase";
import { cpiGetCompletadas, normalizeName, type CpiInvoice } from "@/lib/cpi";
import { isUSDCurrency } from "@/lib/utils";

export type VendorMapRow = { cpi_vendor: string; user_id: string | null };

export type SaleRow = {
  cpi_key: string;
  tipo: string;
  factura: string;
  fecha: string | null;
  origen: string;
  sucursal: string;
  vendedor: string;
  cliente: string;
  moneda: string;
  subtotal: number;
  estado: string;
  user_id: string | null;
};

export type MonthlySales = {
  count: number;
  amountCRC: number;
  amountUSD: number;
};

function keyFor(inv: CpiInvoice): string {
  if (inv.clave) return inv.clave;
  return [inv.tipo, inv.vendedor, inv.fechaIso ?? "", inv.subtotal].join("|");
}

/** Resuelve el mapeo vendedor->usuario, auto-emparejando por nombre si falta. */
async function resolveVendorMap(): Promise<Map<string, string>> {
  const sb = createAdminClient();
  const { data: rows } = await sb
    .from("cpi_vendor_map")
    .select("cpi_vendor, user_id");
  const map = new Map<string, string>();
  const pending: string[] = [];
  for (const r of (rows ?? []) as VendorMapRow[]) {
    if (r.user_id) map.set(r.cpi_vendor, r.user_id);
    else pending.push(r.cpi_vendor);
  }
  if (pending.length === 0) return map;

  // Auto-match por nombre completo (normalizado) contra los usuarios.
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const byName = new Map<string, string>();
  for (const u of list?.users ?? []) {
    const full = (u.user_metadata?.full_name as string | undefined) ?? "";
    if (full) byName.set(normalizeName(full), u.id);
  }
  for (const vendor of pending) {
    const uid = byName.get(normalizeName(vendor));
    if (uid) {
      map.set(vendor, uid);
      // Persistir el match para no repetirlo.
      await sb
        .from("cpi_vendor_map")
        .update({ user_id: uid })
        .eq("cpi_vendor", vendor);
    }
  }
  return map;
}

export type SyncResult = {
  fetched: number;
  upserted: number;
  matchedVendors: number;
  error?: string;
};

/** Trae las facturas completadas de CPI y las guarda (upsert) en Supabase. */
export async function syncCpiSales(): Promise<SyncResult> {
  const sb = createAdminClient();
  const invoices = await cpiGetCompletadas();
  if (invoices.length === 0) {
    return { fetched: 0, upserted: 0, matchedVendors: 0 };
  }
  const vendorMap = await resolveVendorMap();

  const rows: SaleRow[] = invoices.map((inv) => ({
    cpi_key: keyFor(inv),
    tipo: inv.tipo,
    factura: inv.factura,
    fecha: inv.fechaIso,
    origen: inv.origen,
    sucursal: inv.sucursal,
    vendedor: inv.vendedor,
    cliente: inv.cliente,
    moneda: inv.moneda,
    subtotal: inv.subtotal,
    estado: inv.estado,
    user_id: vendorMap.get(inv.vendedor) ?? null,
  }));

  const { error, count } = await sb
    .from("cpi_sales")
    .upsert(rows, { onConflict: "cpi_key", count: "exact" });
  if (error) return { fetched: invoices.length, upserted: 0, matchedVendors: vendorMap.size, error: error.message };

  return {
    fetched: invoices.length,
    upserted: count ?? rows.length,
    matchedVendors: vendorMap.size,
  };
}

function monthRange(year: number, month1: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month1 - 1, 1));
  const to = new Date(Date.UTC(year, month1, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Agregado mensual de ventas para un usuario (por moneda). */
export async function getMonthlySalesForUser(
  userId: string,
  year: number,
  month1: number
): Promise<MonthlySales> {
  const sb = createAdminClient();
  const { from, to } = monthRange(year, month1);
  const { data } = await sb
    .from("cpi_sales")
    .select("moneda, subtotal, estado")
    .eq("user_id", userId)
    .gte("fecha", from)
    .lt("fecha", to);
  let amountCRC = 0;
  let amountUSD = 0;
  let count = 0;
  const rows = (data ?? []) as { moneda: string; subtotal: number; estado: string | null }[];
  for (const r of rows) {
    if (/ANULA/i.test(r.estado || "")) continue; // anuladas no cuentan como venta
    count += 1;
    if (isUSDCurrency(r.moneda)) amountUSD += Number(r.subtotal) || 0;
    else amountCRC += Number(r.subtotal) || 0;
  }
  return { count, amountCRC, amountUSD };
}

/** Facturas de un usuario en un rango (para el detalle de Ventas). */
export async function listSalesForUser(
  userId: string,
  opts: { from: string; to: string; limit?: number }
): Promise<SaleRow[]> {
  const sb = createAdminClient();
  const { from, to } = opts;
  const { data } = await sb
    .from("cpi_sales")
    .select("*")
    .eq("user_id", userId)
    .gte("fecha", from)
    .lt("fecha", to)
    .order("fecha", { ascending: false })
    .limit(opts.limit ?? 200);
  return (data ?? []) as SaleRow[];
}

// --- Mapeo de vendedores (admin) ---

export type VendorStat = {
  cpi_vendor: string;
  user_id: string | null;
  ignored: boolean;
  count: number;
  crc: number;
  usd: number;
};

/** Lista los vendedores de CPI con su usuario asignado y sus totales. */
export async function listVendorsWithStats(): Promise<VendorStat[]> {
  const sb = createAdminClient();
  const [{ data: mapRows }, { data: sales }] = await Promise.all([
    sb.from("cpi_vendor_map").select("cpi_vendor, user_id, ignored"),
    sb.from("cpi_sales").select("vendedor, moneda, subtotal, estado").limit(50000),
  ]);

  const stats = new Map<string, VendorStat>();
  const ensure = (v: string) => {
    const k = v || "—";
    if (!stats.has(k)) stats.set(k, { cpi_vendor: k, user_id: null, ignored: false, count: 0, crc: 0, usd: 0 });
    return stats.get(k)!;
  };
  for (const r of (mapRows ?? []) as { cpi_vendor: string; user_id: string | null }[]) {
    ensure(r.cpi_vendor).user_id = r.user_id;
  }
  for (const s of (sales ?? []) as { vendedor: string; moneda: string; subtotal: number; estado: string | null }[]) {
    if (/ANULA/i.test(s.estado || "")) continue; // anuladas no cuentan
    const st = ensure(s.vendedor);
    st.count += 1;
    if (isUSDCurrency(s.moneda)) st.usd += Number(s.subtotal) || 0;
    else st.crc += Number(s.subtotal) || 0;
  }
  return [...stats.values()].sort((a, b) => b.count - a.count || a.cpi_vendor.localeCompare(b.cpi_vendor));
}

/** Asigna (o desasigna) un vendedor de CPI a un usuario del portal, y
 *  re-aplica el enlace a las facturas ya guardadas de ese vendedor. */
export async function setVendorUser(
  cpiVendor: string,
  userId: string | null
): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("cpi_vendor_map")
    .upsert({ cpi_vendor: cpiVendor, user_id: userId }, { onConflict: "cpi_vendor" });
  await sb.from("cpi_sales").update({ user_id: userId }).eq("vendedor", cpiVendor);
}

/** Excluye o incluye a un vendedor del ranking (no afecta el total de la empresa). */
export async function setVendorIgnored(cpiVendor: string, ignored: boolean): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("cpi_vendor_map")
    .upsert({ cpi_vendor: cpiVendor, ignored }, { onConflict: "cpi_vendor" });
}

/** Nombres de vendedor de CPI asignados a un usuario del portal. */
export async function getVendorsForUser(userId: string): Promise<string[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("cpi_vendor_map")
    .select("cpi_vendor")
    .eq("user_id", userId);
  return (data ?? []).map((r: { cpi_vendor: string }) => r.cpi_vendor);
}
