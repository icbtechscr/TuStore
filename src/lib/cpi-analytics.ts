// Analitica de ventas (sobre cpi_sales) para el panel admin. SOLO servidor.
import { createAdminClient } from "@/lib/supabase";
import {
  getProductSalesAnalytics,
  type TopSoldProduct,
} from "@/lib/cpi-products";
import { isUSDCurrency } from "@/lib/utils";

export type Bucket = { key: string; count: number; crc: number; usd: number };

export type SalesAnalytics = {
  totalCRC: number;
  totalUSD: number;
  count: number;
  aceptadas: number;
  rechazadas: number;
  ticketPromedioCRC: number; // sobre facturas en colones
  ticketPromedioUSD: number; // sobre facturas en dólares
  vendedores: number;
  sucursales: number;
  porSucursal: Bucket[]; // origen (ciudad)
  porVendedor: Bucket[]; // ranking desc por crc
  porPuntoVenta: Bucket[];
  porTipo: Bucket[];
  porCliente: Bucket[];
  porDia: { day: string; crc: number; usd: number; count: number }[];
  productUnits: number;
  productCount: number;
  topProducts: TopSoldProduct[];
  prevMonthCRC: number; // total del periodo anterior comparable (para el crecimiento)
  prevMonthUSD: number;
  hasData: boolean;
};

type Row = {
  fecha: string | null;
  origen: string | null;
  sucursal: string | null;
  vendedor: string | null;
  cliente: string | null;
  moneda: string | null;
  subtotal: number | null;
  estado: string | null;
  tipo: string | null;
};

// --- Periodo (diario / mensual) ---------------------------------------------

export type Period = "day" | "month";

export type PeriodRange = {
  period: Period;
  from: string; // ISO inclusive
  to: string; // ISO exclusivo
  buckets: string[]; // dias YYYY-MM-DD para rellenar la serie
  prevFrom: string; // periodo anterior comparable (crecimiento)
  prevTo: string;
  label: string; // etiqueta legible
  ref: string; // dia YYYY-MM-DD (day) o mes YYYY-MM (month)
};

/** Fecha "hoy" en Costa Rica como YYYY-MM-DD. */
export function crToday(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
}

/** Construye el rango para un periodo diario o mensual a partir de una referencia. */
export function periodRange(period: Period, ref?: string): PeriodRange {
  if (period === "day") {
    const day = ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : crToday();
    const start = new Date(`${day}T00:00:00.000Z`);
    const next = new Date(start.getTime() + 86400000);
    const prev = new Date(start.getTime() - 86400000);
    const label = new Intl.DateTimeFormat("es-CR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${day}T12:00:00.000Z`));
    return {
      period,
      from: start.toISOString(),
      to: next.toISOString(),
      buckets: [day],
      prevFrom: prev.toISOString(),
      prevTo: start.toISOString(),
      label,
      ref: day,
    };
  }
  const ym = ref && /^\d{4}-\d{2}$/.test(ref) ? ref : crToday().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  const days = new Date(y, m, 0).getDate();
  const buckets: string[] = [];
  for (let d = 1; d <= days; d++) {
    buckets.push(`${ym}-${String(d).padStart(2, "0")}`);
  }
  const pm = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const label = new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
  return {
    period,
    from,
    to,
    buckets,
    prevFrom: new Date(Date.UTC(pm.y, pm.m - 1, 1)).toISOString(),
    prevTo: from,
    label,
    ref: ym,
  };
}

function bump(map: Map<string, Bucket>, key: string, crc: number, usd: number) {
  const k = key || "—";
  const b = map.get(k) ?? { key: k, count: 0, crc: 0, usd: 0 };
  b.count += 1;
  b.crc += crc;
  b.usd += usd;
  map.set(k, b);
}

const USD_RATE = 520; // solo para ordenar listas que contienen ambas monedas
const bySortCrc = (a: Bucket, b: Bucket) =>
  b.crc + b.usd * USD_RATE - (a.crc + a.usd * USD_RATE) || b.count - a.count;

// Las facturas anuladas se muestran pero NO cuentan como venta.
const isAnulada = (estado: string | null): boolean => /ANULA/i.test(estado || "");
const isAceptada = (estado: string | null): boolean => /ACEPTAD/i.test(estado || "");
const isRechazada = (estado: string | null): boolean => /RECHAZAD/i.test(estado || "");

async function fetchIgnored(): Promise<Set<string>> {
  try {
    const sb = createAdminClient();
    const { data } = await sb.from("cpi_vendor_map").select("cpi_vendor, ignored").eq("ignored", true);
    return new Set((data ?? []).map((r: { cpi_vendor: string }) => r.cpi_vendor));
  } catch {
    return new Set();
  }
}

export async function getSalesAnalytics(r: PeriodRange): Promise<SalesAnalytics> {
  const empty: SalesAnalytics = {
    totalCRC: 0, totalUSD: 0, count: 0, aceptadas: 0, rechazadas: 0,
    ticketPromedioCRC: 0, ticketPromedioUSD: 0, vendedores: 0, sucursales: 0,
    porSucursal: [], porVendedor: [], porPuntoVenta: [], porTipo: [], porCliente: [],
    porDia: [], productUnits: 0, productCount: 0, topProducts: [],
    prevMonthCRC: 0, prevMonthUSD: 0, hasData: false,
  };

  let rows: Row[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("cpi_sales")
      .select("fecha, origen, sucursal, vendedor, cliente, moneda, subtotal, estado, tipo")
      .gte("fecha", r.from)
      .lt("fecha", r.to)
      .limit(5000);
    rows = (data ?? []) as Row[];
  } catch {
    return empty;
  }
  if (rows.length === 0) return empty;

  const productSales = await getProductSalesAnalytics(r);

  const ignored = await fetchIgnored();
  const suc = new Map<string, Bucket>();
  const ven = new Map<string, Bucket>();
  const pv = new Map<string, Bucket>();
  const tipo = new Map<string, Bucket>();
  const cli = new Map<string, Bucket>();
  const dia = new Map<string, { day: string; crc: number; usd: number; count: number }>();

  let totalCRC = 0, totalUSD = 0, aceptadas = 0, rechazadas = 0;
  let crcCount = 0, usdCount = 0, counted = 0;

  for (const row of rows) {
    if (isAnulada(row.estado)) continue;
    counted += 1;
    const val = Number(row.subtotal) || 0;
    const rowIsUSD = isUSDCurrency(row.moneda);
    const crc = rowIsUSD ? 0 : val;
    const usd = rowIsUSD ? val : 0;
    totalCRC += crc;
    totalUSD += usd;
    if (rowIsUSD) usdCount += 1;
    else crcCount += 1;
    if (isAceptada(row.estado)) aceptadas += 1;
    else if (isRechazada(row.estado)) rechazadas += 1;

    bump(suc, row.origen || "—", crc, usd);
    if (!ignored.has(row.vendedor || "—")) bump(ven, row.vendedor || "—", crc, usd);
    bump(pv, row.sucursal || "—", crc, usd);
    bump(tipo, row.tipo || "Factura", crc, usd);
    if (row.cliente) bump(cli, row.cliente, crc, usd);

    const dkey = (row.fecha || "").slice(0, 10);
    if (dkey) {
      const d = dia.get(dkey) ?? { day: dkey, crc: 0, usd: 0, count: 0 };
      d.crc += crc; d.usd += usd; d.count += 1;
      dia.set(dkey, d);
    }
  }

  // Serie diaria del periodo (rellena dias sin ventas con 0).
  const porDia: SalesAnalytics["porDia"] = [];
  for (const key of r.buckets) {
    porDia.push(dia.get(key) ?? { day: key, crc: 0, usd: 0, count: 0 });
  }

  // Total del periodo anterior comparable (para el crecimiento).
  let prevMonthCRC = 0;
  let prevMonthUSD = 0;
  try {
    const sb = createAdminClient();
    const { data } = await sb.from("cpi_sales").select("moneda, subtotal, estado").gte("fecha", r.prevFrom).lt("fecha", r.prevTo).limit(5000);
    for (const p of (data ?? []) as { moneda: string; subtotal: number; estado: string | null }[]) {
      if (isAnulada(p.estado)) continue;
      if (isUSDCurrency(p.moneda)) prevMonthUSD += Number(p.subtotal) || 0;
      else prevMonthCRC += Number(p.subtotal) || 0;
    }
  } catch { /* ignore */ }

  return {
    totalCRC, totalUSD, count: counted, aceptadas, rechazadas,
    ticketPromedioCRC: crcCount ? Math.round(totalCRC / crcCount) : 0,
    ticketPromedioUSD: usdCount ? totalUSD / usdCount : 0,
    vendedores: ven.size,
    sucursales: suc.size,
    porSucursal: [...suc.values()].sort(bySortCrc),
    porVendedor: [...ven.values()].sort(bySortCrc),
    porPuntoVenta: [...pv.values()].sort(bySortCrc),
    porTipo: [...tipo.values()].sort((a, b) => b.count - a.count),
    porCliente: [...cli.values()].sort(bySortCrc).slice(0, 10),
    porDia,
    productUnits: productSales.totalUnits,
    productCount: productSales.productCount,
    topProducts: productSales.topProducts,
    prevMonthCRC, prevMonthUSD,
    hasData: true,
  };
}

// --- Analitica por vendedor (portal del colaborador) ---

export type UserSalesAnalytics = {
  count: number;
  amountCRC: number;
  amountUSD: number;
  ticketPromedioCRC: number;
  ticketPromedioUSD: number;
  aceptadas: number;
  rechazadas: number;
  porDia: { day: string; crc: number; usd: number }[];
  porSucursal: Bucket[];
  // Ranking (por "valor" = CRC + USD*520, un proxy para ordenar mezclando moneda)
  rank: number | null;
  totalVendedores: number;
  sharePct: number | null; // % del total de la empresa
  myValor: number;
  leaderValor: number;
  hasData: boolean;
};

export async function getUserSalesAnalytics(
  userId: string,
  r: PeriodRange
): Promise<UserSalesAnalytics> {
  const empty: UserSalesAnalytics = {
    count: 0, amountCRC: 0, amountUSD: 0, ticketPromedioCRC: 0, ticketPromedioUSD: 0,
    aceptadas: 0, rechazadas: 0, porDia: [], porSucursal: [],
    rank: null, totalVendedores: 0, sharePct: null, myValor: 0, leaderValor: 0,
    hasData: false,
  };
  let rows: (Row & { user_id: string | null })[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("cpi_sales")
      .select("fecha, origen, sucursal, vendedor, cliente, moneda, subtotal, estado, tipo, user_id")
      .gte("fecha", r.from)
      .lt("fecha", r.to)
      .limit(5000);
    rows = (data ?? []) as (Row & { user_id: string | null })[];
  } catch {
    return empty;
  }
  if (rows.length === 0) return empty;

  const ignored = await fetchIgnored();
  // Valor por vendedor (para ranking) — solo filas con user_id y no excluidas.
  const valorByUser = new Map<string, number>();
  for (const row of rows) {
    if (!row.user_id) continue;
    if (ignored.has(row.vendedor || "")) continue;
    if (isAnulada(row.estado)) continue;
    const v = Number(row.subtotal) || 0;
    const valor = isUSDCurrency(row.moneda) ? v * USD_RATE : v;
    valorByUser.set(row.user_id, (valorByUser.get(row.user_id) ?? 0) + valor);
  }
  const ranking = [...valorByUser.entries()].sort((a, b) => b[1] - a[1]);
  const totalVendedores = ranking.length;
  const companyValor = ranking.reduce((s, [, v]) => s + v, 0);
  const leaderValor = ranking[0]?.[1] ?? 0;
  const myValor = valorByUser.get(userId) ?? 0;
  const rankIdx = ranking.findIndex(([id]) => id === userId);
  const rank = rankIdx >= 0 ? rankIdx + 1 : null;

  // Metricas propias.
  const mine = rows.filter((row) => row.user_id === userId && !isAnulada(row.estado));
  let amountCRC = 0, amountUSD = 0, aceptadas = 0, rechazadas = 0, crcCount = 0, usdCount = 0;
  const suc = new Map<string, Bucket>();
  const dia = new Map<string, { crc: number; usd: number }>();
  for (const row of mine) {
    const v = Number(row.subtotal) || 0;
    const rowIsUSD = isUSDCurrency(row.moneda);
    if (rowIsUSD) { amountUSD += v; usdCount += 1; } else { amountCRC += v; crcCount += 1; }
    if (isAceptada(row.estado)) aceptadas += 1;
    else if (isRechazada(row.estado)) rechazadas += 1;
    bump(suc, row.origen || "—", rowIsUSD ? 0 : v, rowIsUSD ? v : 0);
    const dk = (row.fecha || "").slice(0, 10);
    if (dk) {
      const amount = dia.get(dk) ?? { crc: 0, usd: 0 };
      if (rowIsUSD) amount.usd += v;
      else amount.crc += v;
      dia.set(dk, amount);
    }
  }
  const porDia: { day: string; crc: number; usd: number }[] = [];
  for (const key of r.buckets) {
    const amount = dia.get(key) ?? { crc: 0, usd: 0 };
    porDia.push({ day: key, ...amount });
  }

  return {
    count: mine.length, amountCRC, amountUSD,
    ticketPromedioCRC: crcCount ? Math.round(amountCRC / crcCount) : 0,
    ticketPromedioUSD: usdCount ? amountUSD / usdCount : 0,
    aceptadas, rechazadas, porDia,
    porSucursal: [...suc.values()].sort(bySortCrc),
    rank, totalVendedores,
    sharePct: companyValor > 0 ? Math.round((myValor / companyValor) * 1000) / 10 : null,
    myValor, leaderValor,
    hasData: mine.length > 0,
  };
}

export type MonthPoint = { ym: string; label: string; crc: number; usd: number; count: number };

/** Evolucion de los ultimos N meses (monto CRC) para un vendedor. */
export async function getUserMonthlyEvolution(
  userId: string,
  monthsBack = 6,
  now: Date = new Date()
): Promise<MonthPoint[]> {
  const points: MonthPoint[] = [];
  const base: { year: number; month1: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    base.push({ year: d.getFullYear(), month1: d.getMonth() + 1 });
  }
  try {
    const sb = createAdminClient();
    const from = new Date(Date.UTC(base[0].year, base[0].month1 - 1, 1)).toISOString();
    const { data } = await sb
      .from("cpi_sales")
      .select("fecha, moneda, subtotal, estado")
      .eq("user_id", userId)
      .gte("fecha", from)
      .limit(5000);
    const byMonth = new Map<string, { crc: number; usd: number; count: number }>();
    for (const r of (data ?? []) as { fecha: string | null; moneda: string; subtotal: number; estado: string | null }[]) {
      const ym = (r.fecha || "").slice(0, 7);
      if (!ym) continue;
      if (isAnulada(r.estado)) continue;
      const m = byMonth.get(ym) ?? { crc: 0, usd: 0, count: 0 };
      if (isUSDCurrency(r.moneda)) m.usd += Number(r.subtotal) || 0;
      else m.crc += Number(r.subtotal) || 0;
      m.count += 1;
      byMonth.set(ym, m);
    }
    for (const b of base) {
      const ym = `${b.year}-${String(b.month1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("es-CR", { month: "short" }).format(new Date(b.year, b.month1 - 1, 1));
      const m = byMonth.get(ym) ?? { crc: 0, usd: 0, count: 0 };
      points.push({ ym, label, crc: m.crc, usd: m.usd, count: m.count });
    }
  } catch {
    return base.map((b) => ({
      ym: `${b.year}-${String(b.month1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("es-CR", { month: "short" }).format(new Date(b.year, b.month1 - 1, 1)),
      crc: 0, usd: 0, count: 0,
    }));
  }
  return points;
}

// --- Desempeño por vendedor (panel admin) ---

export type VendorPerf = {
  vendedor: string;
  count: number;
  crc: number;
  usd: number;
  aceptadas: number;
  rechazadas: number;
  ticketCRC: number;
  ticketUSD: number;
  valor: number; // crc + usd*USD_RATE (para ordenar)
  sharePct: number;
  rank: number;
};

export type VendorPerformance = {
  vendors: VendorPerf[];
  totalCRC: number;
  totalUSD: number;
  count: number;
  companyValor: number;
  leaderValor: number;
  hasData: boolean;
};

export async function getVendorPerformance(r: PeriodRange): Promise<VendorPerformance> {
  const empty: VendorPerformance = {
    vendors: [], totalCRC: 0, totalUSD: 0, count: 0,
    companyValor: 0, leaderValor: 0, hasData: false,
  };
  let rows: Row[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("cpi_sales")
      .select("vendedor, moneda, subtotal, estado")
      .gte("fecha", r.from)
      .lt("fecha", r.to)
      .limit(5000);
    rows = (data ?? []) as Row[];
  } catch {
    return empty;
  }
  if (rows.length === 0) return empty;
  const ignored = await fetchIgnored();
  type Agg = { crc: number; usd: number; count: number; crcCount: number; usdCount: number; aceptadas: number; rechazadas: number };
  const map = new Map<string, Agg>();
  let totalCRC = 0, totalUSD = 0, counted = 0;
  for (const row of rows) {
    const vend = row.vendedor || "—";
    if (ignored.has(vend)) continue;
    if (isAnulada(row.estado)) continue;
    const v = Number(row.subtotal) || 0;
    const rowIsUSD = isUSDCurrency(row.moneda);
    totalCRC += rowIsUSD ? 0 : v;
    totalUSD += rowIsUSD ? v : 0;
    counted += 1;
    const a = map.get(vend) ?? { crc: 0, usd: 0, count: 0, crcCount: 0, usdCount: 0, aceptadas: 0, rechazadas: 0 };
    if (rowIsUSD) { a.usd += v; a.usdCount += 1; } else { a.crc += v; a.crcCount += 1; }
    a.count += 1;
    if (isAceptada(row.estado)) a.aceptadas += 1;
    else if (isRechazada(row.estado)) a.rechazadas += 1;
    map.set(vend, a);
  }

  const list = [...map.entries()].map(([vendedor, a]) => ({
    vendedor, count: a.count, crc: a.crc, usd: a.usd,
    aceptadas: a.aceptadas, rechazadas: a.rechazadas,
    ticketCRC: a.crcCount ? Math.round(a.crc / a.crcCount) : 0,
    ticketUSD: a.usdCount ? a.usd / a.usdCount : 0,
    valor: a.crc + a.usd * USD_RATE,
  }));
  list.sort((x, y) => y.valor - x.valor);
  const companyValor = list.reduce((s, v) => s + v.valor, 0);
  const leaderValor = list[0]?.valor ?? 0;
  const vendors: VendorPerf[] = list.map((v, i) => ({
    ...v,
    rank: i + 1,
    sharePct: companyValor > 0 ? Math.round((v.valor / companyValor) * 1000) / 10 : 0,
  }));

  return {
    vendors, totalCRC, totalUSD, count: counted,
    companyValor, leaderValor, hasData: vendors.length > 0,
  };
}
