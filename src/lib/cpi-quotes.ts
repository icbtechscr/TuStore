// Capa de servidor para cotizaciones CPI: sincronizacion y analitica.
import { createAdminClient } from "@/lib/supabase";
import {
  cpiGetCotizacionesWithLines,
  normalizeName,
  type CpiQuoteWithLines,
} from "@/lib/cpi";

type VendorMapRow = { cpi_vendor: string; user_id: string | null };

export type QuoteSyncOptions = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  limit?: number;
};

export type SyncQuotesResult = {
  fetched: number;
  upserted: number;
  lines: number;
  matchedVendors: number;
  from: string;
  to: string;
  error?: string;
};

export type QuoteBucket = { key: string; count: number; crc: number; usd: number };

export type TopQuotedProduct = {
  descripcion: string;
  sku: string;
  quoteCount: number;
  cantidad: number;
  crc: number;
  usd: number;
};

export type RecentQuote = {
  quoteNumber: string;
  fecha: string | null;
  cliente: string;
  vendedor: string;
  moneda: string;
  subtotal: number;
  lineCount: number;
};

export type VendorQuoteProduct = {
  descripcion: string;
  sku: string;
  quoteCount: number;
  cantidad: number;
  crc: number;
  usd: number;
};

export type QuoteVendorPerf = {
  vendedor: string;
  rank: number;
  count: number;
  crc: number;
  usd: number;
  valor: number;
  ticketCRC: number;
  clientes: number;
  productos: number;
  lineas: number;
  activeDays: number;
  bestDay: string | null;
  sharePct: number;
  topProducts: VendorQuoteProduct[];
};

export type QuoteVendorDay = {
  day: string;
  count: number;
  crc: number;
  usd: number;
  vendors: number;
  clientes: number;
  productos: number;
  lineas: number;
  leader: string;
  leaderCount: number;
};

export type QuoteVendorPerformance = {
  vendors: QuoteVendorPerf[];
  totalCRC: number;
  totalUSD: number;
  count: number;
  clientes: number;
  productos: number;
  lineas: number;
  activeDays: number;
  porDia: QuoteVendorDay[];
  topProducts: VendorQuoteProduct[];
  hasData: boolean;
};

export type UserQuoteDaySummary = {
  day: string;
  count: number;
  crc: number;
  usd: number;
  clientes: number;
  productos: number;
  lineas: number;
};

export type UserQuoteAnalytics = {
  count: number;
  amountCRC: number;
  amountUSD: number;
  ticketPromedioCRC: number;
  clientes: number;
  productos: number;
  lineas: number;
  activeDays: number;
  porDia: UserQuoteDaySummary[];
  porSucursal: QuoteBucket[];
  topProducts: VendorQuoteProduct[];
  rank: number | null;
  totalVendedores: number;
  sharePct: number | null;
  myValor: number;
  leaderValor: number;
  leaderName: string;
  leaderCount: number;
  hasData: boolean;
};

export type QuoteMonthPoint = {
  ym: string;
  label: string;
  count: number;
  crc: number;
};

export type QuoteAnalytics = {
  totalCRC: number;
  totalUSD: number;
  count: number;
  ticketPromedioCRC: number;
  productos: number;
  vendedores: number;
  clientes: number;
  porDia: { day: string; count: number; crc: number; usd: number }[];
  porVendedor: QuoteBucket[];
  porSucursal: QuoteBucket[];
  porCliente: QuoteBucket[];
  topProducts: TopQuotedProduct[];
  recentQuotes: RecentQuote[];
  hasData: boolean;
};

type QuoteDbRow = {
  id?: string;
  cpi_key: string;
  cpi_id: string;
  quote_number: string;
  tipo: string;
  fecha: string | null;
  origen: string;
  sucursal: string;
  sucursal_code: string;
  point_of_sale_code: string;
  vendedor: string;
  vendedor_cod: string;
  cliente: string;
  cliente_id: string;
  medio_pago: string;
  moneda: string;
  subtotal: number;
  estado: string;
  actividad: string;
  user_id: string | null;
};

type QuoteLineDbRow = {
  cpi_key: string;
  quote_number: string;
  line_id: string | null;
  linea: number | null;
  item_id: string | null;
  sku: string | null;
  descripcion: string;
  cantidad: number;
  precio_unit: number;
  descuento: number;
  subtotal: number;
  impuesto: number;
  total: number;
  total_con_impuesto: number;
};

function crDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function defaultRange(opts: QuoteSyncOptions): { from: string; to: string } {
  const today = crDate();
  return { from: opts.from || today, to: opts.to || opts.from || today };
}

function monthRange(year: number, month1: number): { from: string; to: string; days: number } {
  const from = new Date(Date.UTC(year, month1 - 1, 1));
  const to = new Date(Date.UTC(year, month1, 1));
  const days = new Date(year, month1, 0).getDate();
  return { from: from.toISOString(), to: to.toISOString(), days };
}

function dayStart(day: string): string {
  return `${day.slice(0, 10)}T00:00:00-06:00`;
}

function dayEnd(day: string): string {
  return `${day.slice(0, 10)}T23:59:59-06:00`;
}

function dbDate(dayOrIso: string | null): string | null {
  if (!dayOrIso) return null;
  const day = dayOrIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return `${day}T12:00:00-06:00`;
}

function keyFor(quote: CpiQuoteWithLines): string {
  return quote.quoteNumber || quote.cpiId;
}

function uniqueQuotes(quotes: CpiQuoteWithLines[]): CpiQuoteWithLines[] {
  const map = new Map<string, CpiQuoteWithLines>();
  for (const quote of quotes) {
    const key = keyFor(quote);
    if (key) map.set(key, quote);
  }
  return [...map.values()];
}

async function ensureVendors(vendors: string[]): Promise<void> {
  const rows = [...new Set(vendors.filter(Boolean))].map((cpi_vendor) => ({
    cpi_vendor,
  }));
  if (rows.length === 0) return;
  const sb = createAdminClient();
  await sb.from("cpi_vendor_map").upsert(rows, { onConflict: "cpi_vendor" });
}

async function resolveVendorMap(): Promise<Map<string, string>> {
  const sb = createAdminClient();
  const { data: rows } = await sb
    .from("cpi_vendor_map")
    .select("cpi_vendor, user_id");
  const map = new Map<string, string>();
  const pending: string[] = [];
  for (const row of (rows ?? []) as VendorMapRow[]) {
    if (row.user_id) map.set(row.cpi_vendor, row.user_id);
    else pending.push(row.cpi_vendor);
  }
  if (pending.length === 0) return map;

  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const byName = new Map<string, string>();
  for (const user of list?.users ?? []) {
    const full = (user.user_metadata?.full_name as string | undefined) ?? "";
    if (full) byName.set(normalizeName(full), user.id);
  }
  for (const vendor of pending) {
    const userId = byName.get(normalizeName(vendor));
    if (!userId) continue;
    map.set(vendor, userId);
    await sb.from("cpi_vendor_map").update({ user_id: userId }).eq("cpi_vendor", vendor);
  }
  return map;
}

export async function syncCpiQuotes(
  opts: QuoteSyncOptions = {}
): Promise<SyncQuotesResult> {
  const { from, to } = defaultRange(opts);
  const fetched = uniqueQuotes(
    await cpiGetCotizacionesWithLines({ from, to, limit: opts.limit ?? 1000 })
  );
  if (fetched.length === 0) {
    return { fetched: 0, upserted: 0, lines: 0, matchedVendors: 0, from, to };
  }

  await ensureVendors(fetched.map((quote) => quote.vendedor));
  const vendorMap = await resolveVendorMap();
  const quoteRows: QuoteDbRow[] = fetched.map((quote) => ({
    cpi_key: keyFor(quote),
    cpi_id: quote.cpiId,
    quote_number: quote.quoteNumber,
    tipo: quote.tipo || "Cotizacion",
    fecha: dbDate(quote.fechaIso),
    origen: quote.origen,
    sucursal: quote.sucursal,
    sucursal_code: quote.sucursalCode,
    point_of_sale_code: quote.puntoVentaCode,
    vendedor: quote.vendedor,
    vendedor_cod: quote.vendedorCod,
    cliente: quote.cliente,
    cliente_id: quote.clienteId,
    medio_pago: quote.medioPago,
    moneda: quote.moneda || "CRC",
    subtotal: quote.subtotal,
    estado: quote.estado,
    actividad: quote.actividad,
    user_id: vendorMap.get(quote.vendedor) ?? null,
  }));

  const sb = createAdminClient();
  const keys = quoteRows.map((row) => row.cpi_key);
  await sb.from("cpi_quotes").delete().gte("fecha", dayStart(from)).lte("fecha", dayEnd(to));
  const { data: savedQuotes, error } = await sb
    .from("cpi_quotes")
    .upsert(quoteRows, { onConflict: "cpi_key" })
    .select("id, cpi_key");
  if (error) {
    return {
      fetched: fetched.length,
      upserted: 0,
      lines: 0,
      matchedVendors: vendorMap.size,
      from,
      to,
      error: error.message,
    };
  }

  await sb.from("cpi_quote_lines").delete().in("cpi_key", keys);
  const idByKey = new Map(
    ((savedQuotes ?? []) as { id: string; cpi_key: string }[]).map((row) => [
      row.cpi_key,
      row.id,
    ])
  );
  const lineRows = fetched.flatMap((quote) => {
    const key = keyFor(quote);
    const quoteId = idByKey.get(key) ?? null;
    return quote.lines.map((line) => ({
      quote_id: quoteId,
      cpi_key: key,
      quote_number: quote.quoteNumber,
      line_id: line.lineId || null,
      linea: line.lineNo || null,
      item_id: line.itemId || null,
      sku: line.sku || null,
      descripcion: line.descripcion,
      cantidad: line.cantidad,
      precio_unit: line.precioUnit,
      descuento: line.descuento,
      subtotal: line.subtotal,
      impuesto: line.impuesto,
      total: line.total,
      total_con_impuesto: line.totalConImpuesto,
    }));
  });
  if (lineRows.length > 0) {
    const { error: linesError } = await sb.from("cpi_quote_lines").insert(lineRows);
    if (linesError) {
      return {
        fetched: fetched.length,
        upserted: savedQuotes?.length ?? quoteRows.length,
        lines: 0,
        matchedVendors: vendorMap.size,
        from,
        to,
        error: linesError.message,
      };
    }
  }

  return {
    fetched: fetched.length,
    upserted: savedQuotes?.length ?? quoteRows.length,
    lines: lineRows.length,
    matchedVendors: vendorMap.size,
    from,
    to,
  };
}

function bump(map: Map<string, QuoteBucket>, key: string, crc: number, usd: number) {
  const k = key || "-";
  const bucket = map.get(k) ?? { key: k, count: 0, crc: 0, usd: 0 };
  bucket.count += 1;
  bucket.crc += crc;
  bucket.usd += usd;
  map.set(k, bucket);
}

function productKey(desc: string, sku: string | null): string {
  return normalizeName(sku || desc).slice(0, 160);
}

function byValue(a: QuoteBucket, b: QuoteBucket) {
  return b.crc - a.crc || b.usd - a.usd || b.count - a.count;
}

const USD_RATE = 520;

async function fetchQuoteLines(keys: string[]): Promise<QuoteLineDbRow[]> {
  if (keys.length === 0) return [];
  const sb = createAdminClient();
  const rows: QuoteLineDbRow[] = [];
  for (let i = 0; i < keys.length; i += 400) {
    const chunk = keys.slice(i, i + 400);
    const { data } = await sb
      .from("cpi_quote_lines")
      .select(
        "cpi_key, quote_number, line_id, linea, item_id, sku, descripcion, cantidad, precio_unit, descuento, subtotal, impuesto, total, total_con_impuesto"
      )
      .in("cpi_key", chunk)
      .limit(50000);
    rows.push(...(((data ?? []) as QuoteLineDbRow[]) ?? []));
  }
  return rows;
}

async function fetchIgnoredVendors(): Promise<Set<string>> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("cpi_vendor_map")
      .select("cpi_vendor, ignored")
      .eq("ignored", true);
    return new Set((data ?? []).map((row: { cpi_vendor: string }) => row.cpi_vendor));
  } catch {
    return new Set();
  }
}

function toVendorProducts(products: Map<string, {
  descripcion: string;
  sku: string;
  quotes: Set<string>;
  cantidad: number;
  crc: number;
  usd: number;
}>): VendorQuoteProduct[] {
  return [...products.values()]
    .map((item) => ({
      descripcion: item.descripcion,
      sku: item.sku,
      quoteCount: item.quotes.size,
      cantidad: item.cantidad,
      crc: item.crc,
      usd: item.usd,
    }))
    .sort((a, b) => b.quoteCount - a.quoteCount || b.cantidad - a.cantidad || b.crc - a.crc)
    .slice(0, 8);
}

function emptyAnalytics(dayKeys: string[] = []): QuoteAnalytics {
  return {
    totalCRC: 0,
    totalUSD: 0,
    count: 0,
    ticketPromedioCRC: 0,
    productos: 0,
    vendedores: 0,
    clientes: 0,
    porDia: dayKeys.map((day) => ({ day, count: 0, crc: 0, usd: 0 })),
    porVendedor: [],
    porSucursal: [],
    porCliente: [],
    topProducts: [],
    recentQuotes: [],
    hasData: false,
  };
}

function dayKeysForMonth(year: number, month1: number): string[] {
  const days = new Date(year, month1, 0).getDate();
  const keys: string[] = [];
  for (let d = 1; d <= days; d++) {
    keys.push(`${year}-${String(month1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return keys;
}

function addDays(day: string, amount: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, date + amount));
  return d.toISOString().slice(0, 10);
}

function dayKeysForRange(fromDay: string, toDay: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay)) {
    return [];
  }
  if (fromDay > toDay) return [];
  const keys: string[] = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    keys.push(day);
  }
  return keys;
}

async function getQuoteAnalyticsForRange(
  fromDay: string,
  toDay: string,
  dayKeys: string[]
): Promise<QuoteAnalytics> {
  const empty = emptyAnalytics(dayKeys);
  if (!fromDay || !toDay || fromDay > toDay) return empty;

  let quotes: QuoteDbRow[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("cpi_quotes")
      .select(
        "id, cpi_key, cpi_id, quote_number, tipo, fecha, origen, sucursal, sucursal_code, point_of_sale_code, vendedor, vendedor_cod, cliente, cliente_id, medio_pago, moneda, subtotal, estado, actividad, user_id"
      )
      .gte("fecha", dayStart(fromDay))
      .lte("fecha", dayEnd(toDay))
      .order("fecha", { ascending: false })
      .limit(50000);
    quotes = (data ?? []) as QuoteDbRow[];
  } catch {
    return empty;
  }
  if (quotes.length === 0) return empty;

  const lines = await fetchQuoteLines(quotes.map((quote) => quote.cpi_key));
  const quoteByKey = new Map(quotes.map((quote) => [quote.cpi_key, quote]));
  const lineCountByKey = new Map<string, number>();
  for (const line of lines) {
    lineCountByKey.set(line.cpi_key, (lineCountByKey.get(line.cpi_key) ?? 0) + 1);
  }

  const dia = new Map<string, { day: string; count: number; crc: number; usd: number }>();
  const ven = new Map<string, QuoteBucket>();
  const suc = new Map<string, QuoteBucket>();
  const cli = new Map<string, QuoteBucket>();
  const clients = new Set<string>();
  const vendors = new Set<string>();
  let totalCRC = 0;
  let totalUSD = 0;
  let crcCount = 0;

  for (const quote of quotes) {
    const amount = Number(quote.subtotal) || 0;
    const isUSD = quote.moneda === "USD";
    const crc = isUSD ? 0 : amount;
    const usd = isUSD ? amount : 0;
    totalCRC += crc;
    totalUSD += usd;
    if (!isUSD) crcCount += 1;
    if (quote.vendedor) vendors.add(quote.vendedor);
    if (quote.cliente) clients.add(quote.cliente);
    bump(ven, quote.vendedor, crc, usd);
    bump(suc, quote.origen || quote.sucursal, crc, usd);
    bump(cli, quote.cliente, crc, usd);
    const day = (quote.fecha || "").slice(0, 10);
    if (day) {
      const bucket = dia.get(day) ?? { day, count: 0, crc: 0, usd: 0 };
      bucket.count += 1;
      bucket.crc += crc;
      bucket.usd += usd;
      dia.set(day, bucket);
    }
  }

  const porDia = dayKeys.map((key) => dia.get(key) ?? { day: key, count: 0, crc: 0, usd: 0 });

  type ProductAgg = {
    descripcion: string;
    sku: string;
    quotes: Set<string>;
    cantidad: number;
    crc: number;
    usd: number;
  };
  const products = new Map<string, ProductAgg>();
  for (const line of lines) {
    const desc = (line.descripcion || "").trim();
    if (!desc) continue;
    const quote = quoteByKey.get(line.cpi_key);
    if (!quote) continue;
    const key = productKey(desc, line.sku);
    const agg =
      products.get(key) ??
      {
        descripcion: desc,
        sku: line.sku || "",
        quotes: new Set<string>(),
        cantidad: 0,
        crc: 0,
        usd: 0,
      };
    const total = Number(line.total_con_impuesto || line.total || line.subtotal) || 0;
    agg.quotes.add(line.cpi_key);
    agg.cantidad += Number(line.cantidad) || 0;
    if (quote.moneda === "USD") agg.usd += total;
    else agg.crc += total;
    products.set(key, agg);
  }

  const topProducts: TopQuotedProduct[] = [...products.values()]
    .map((item) => ({
      descripcion: item.descripcion,
      sku: item.sku,
      quoteCount: item.quotes.size,
      cantidad: item.cantidad,
      crc: item.crc,
      usd: item.usd,
    }))
    .sort((a, b) => b.quoteCount - a.quoteCount || b.cantidad - a.cantidad || b.crc - a.crc)
    .slice(0, 20);

  return {
    totalCRC,
    totalUSD,
    count: quotes.length,
    ticketPromedioCRC: crcCount ? Math.round(totalCRC / crcCount) : 0,
    productos: products.size,
    vendedores: vendors.size,
    clientes: clients.size,
    porDia,
    porVendedor: [...ven.values()].sort(byValue).slice(0, 15),
    porSucursal: [...suc.values()].sort(byValue).slice(0, 15),
    porCliente: [...cli.values()].sort(byValue).slice(0, 15),
    topProducts,
    recentQuotes: quotes.slice(0, 20).map((quote) => ({
      quoteNumber: quote.quote_number,
      fecha: quote.fecha,
      cliente: quote.cliente,
      vendedor: quote.vendedor,
      moneda: quote.moneda,
      subtotal: Number(quote.subtotal) || 0,
      lineCount: lineCountByKey.get(quote.cpi_key) ?? 0,
    })),
    hasData: true,
  };
}

export async function getQuoteDayAnalytics(day: string): Promise<QuoteAnalytics> {
  const cleanDay = day.slice(0, 10);
  return getQuoteAnalyticsForRange(cleanDay, cleanDay, [cleanDay]);
}

export async function getQuoteRangeAnalytics(
  fromDay: string,
  toDay: string
): Promise<QuoteAnalytics> {
  const from = fromDay.slice(0, 10);
  const to = toDay.slice(0, 10);
  return getQuoteAnalyticsForRange(from, to, dayKeysForRange(from, to));
}

export async function getQuoteAnalytics(
  year: number,
  month1: number
): Promise<QuoteAnalytics> {
  const from = `${year}-${String(month1).padStart(2, "0")}-01`;
  const days = new Date(year, month1, 0).getDate();
  const to = `${year}-${String(month1).padStart(2, "0")}-${String(days).padStart(2, "0")}`;
  return getQuoteAnalyticsForRange(from, to, dayKeysForMonth(year, month1));
}

function preferredName(names: Map<string, number>): string {
  return (
    [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    "-"
  );
}

function emptyUserQuoteAnalytics(dayKeys: string[]): UserQuoteAnalytics {
  return {
    count: 0,
    amountCRC: 0,
    amountUSD: 0,
    ticketPromedioCRC: 0,
    clientes: 0,
    productos: 0,
    lineas: 0,
    activeDays: 0,
    porDia: dayKeys.map((day) => ({
      day,
      count: 0,
      crc: 0,
      usd: 0,
      clientes: 0,
      productos: 0,
      lineas: 0,
    })),
    porSucursal: [],
    topProducts: [],
    rank: null,
    totalVendedores: 0,
    sharePct: null,
    myValor: 0,
    leaderValor: 0,
    leaderName: "",
    leaderCount: 0,
    hasData: false,
  };
}

async function getUserQuoteAnalyticsForDays(
  userId: string,
  fromDay: string,
  toDay: string,
  dayKeys: string[]
): Promise<UserQuoteAnalytics> {
  const empty = emptyUserQuoteAnalytics(dayKeys);
  if (!fromDay || !toDay || fromDay > toDay) return empty;

  let quotes: QuoteDbRow[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("cpi_quotes")
      .select(
        "id, cpi_key, cpi_id, quote_number, tipo, fecha, origen, sucursal, sucursal_code, point_of_sale_code, vendedor, vendedor_cod, cliente, cliente_id, medio_pago, moneda, subtotal, estado, actividad, user_id"
      )
      .gte("fecha", dayStart(fromDay))
      .lte("fecha", dayEnd(toDay))
      .limit(50000);
    quotes = (data ?? []) as QuoteDbRow[];
  } catch {
    return empty;
  }
  if (quotes.length === 0) return empty;

  const ignored = await fetchIgnoredVendors();
  type RankAgg = {
    userId: string;
    count: number;
    crc: number;
    usd: number;
    valor: number;
    names: Map<string, number>;
  };
  const rankByUser = new Map<string, RankAgg>();
  for (const quote of quotes) {
    if (!quote.user_id || ignored.has(quote.vendedor || "")) continue;
    const amount = Number(quote.subtotal) || 0;
    const isUSD = quote.moneda === "USD";
    const agg =
      rankByUser.get(quote.user_id) ??
      {
        userId: quote.user_id,
        count: 0,
        crc: 0,
        usd: 0,
        valor: 0,
        names: new Map<string, number>(),
      };
    agg.count += 1;
    if (isUSD) agg.usd += amount;
    else agg.crc += amount;
    agg.valor += isUSD ? amount * USD_RATE : amount;
    const vendorName = quote.vendedor || "-";
    agg.names.set(vendorName, (agg.names.get(vendorName) ?? 0) + 1);
    rankByUser.set(quote.user_id, agg);
  }
  const ranking = [...rankByUser.values()].sort(
    (a, b) => b.count - a.count || b.valor - a.valor || preferredName(a.names).localeCompare(preferredName(b.names))
  );
  const leader = ranking[0];
  const myRank = ranking.findIndex((item) => item.userId === userId);
  const myRankAgg = rankByUser.get(userId);
  const companyCount = ranking.reduce((sum, item) => sum + item.count, 0);

  const mine = quotes.filter((quote) => quote.user_id === userId);
  if (mine.length === 0) {
    return {
      ...empty,
      totalVendedores: ranking.length,
      leaderValor: leader?.valor ?? 0,
      leaderName: leader ? preferredName(leader.names) : "",
      leaderCount: leader?.count ?? 0,
    };
  }

  const quoteByKey = new Map(mine.map((quote) => [quote.cpi_key, quote]));
  const lines = await fetchQuoteLines(mine.map((quote) => quote.cpi_key));
  const suc = new Map<string, QuoteBucket>();
  const clients = new Set<string>();
  const activeDays = new Set<string>();
  type DayAgg = {
    day: string;
    count: number;
    crc: number;
    usd: number;
    clientes: Set<string>;
    productos: Set<string>;
    lineas: number;
  };
  type ProductAgg = {
    descripcion: string;
    sku: string;
    quotes: Set<string>;
    cantidad: number;
    crc: number;
    usd: number;
  };
  const products = new Map<string, ProductAgg>();
  const dia = new Map<string, DayAgg>();
  let amountCRC = 0;
  let amountUSD = 0;
  let crcCount = 0;
  const ensureDay = (day: string) => {
    const current =
      dia.get(day) ??
      {
        day,
        count: 0,
        crc: 0,
        usd: 0,
        clientes: new Set<string>(),
        productos: new Set<string>(),
        lineas: 0,
      };
    dia.set(day, current);
    return current;
  };

  for (const quote of mine) {
    const amount = Number(quote.subtotal) || 0;
    const isUSD = quote.moneda === "USD";
    const crc = isUSD ? 0 : amount;
    const usd = isUSD ? amount : 0;
    amountCRC += crc;
    amountUSD += usd;
    if (!isUSD) crcCount += 1;
    if (quote.cliente) clients.add(quote.cliente);
    bump(suc, quote.origen || quote.sucursal, crc, usd);
    const day = (quote.fecha || "").slice(0, 10);
    if (day) {
      activeDays.add(day);
      const bucket = ensureDay(day);
      bucket.count += 1;
      bucket.crc += crc;
      bucket.usd += usd;
      if (quote.cliente) bucket.clientes.add(quote.cliente);
    }
  }

  for (const line of lines) {
    const quote = quoteByKey.get(line.cpi_key);
    if (!quote) continue;
    const desc = (line.descripcion || "").trim();
    if (!desc) continue;
    const key = productKey(desc, line.sku);
    const agg =
      products.get(key) ??
      {
        descripcion: desc,
        sku: line.sku || "",
        quotes: new Set<string>(),
        cantidad: 0,
        crc: 0,
        usd: 0,
      };
    const total = Number(line.total_con_impuesto || line.total || line.subtotal) || 0;
    agg.quotes.add(line.cpi_key);
    agg.cantidad += Number(line.cantidad) || 0;
    if (quote.moneda === "USD") agg.usd += total;
    else agg.crc += total;
    products.set(key, agg);
    const day = (quote.fecha || "").slice(0, 10);
    if (day) {
      const dayAgg = ensureDay(day);
      dayAgg.lineas += 1;
      dayAgg.productos.add(key);
    }
  }

  return {
    count: mine.length,
    amountCRC,
    amountUSD,
    ticketPromedioCRC: crcCount ? Math.round(amountCRC / crcCount) : 0,
    clientes: clients.size,
    productos: products.size,
    lineas: lines.length,
    activeDays: activeDays.size,
    porDia: dayKeys.map((day) => {
      const item = dia.get(day);
      return item
        ? {
            day,
            count: item.count,
            crc: item.crc,
            usd: item.usd,
            clientes: item.clientes.size,
            productos: item.productos.size,
            lineas: item.lineas,
          }
        : {
            day,
            count: 0,
            crc: 0,
            usd: 0,
            clientes: 0,
            productos: 0,
            lineas: 0,
          };
    }),
    porSucursal: [...suc.values()].sort(byValue),
    topProducts: toVendorProducts(products),
    rank: myRank >= 0 ? myRank + 1 : null,
    totalVendedores: ranking.length,
    sharePct: companyCount > 0 ? Math.round((mine.length / companyCount) * 1000) / 10 : null,
    myValor: myRankAgg?.valor ?? amountCRC + amountUSD * USD_RATE,
    leaderValor: leader?.valor ?? 0,
    leaderName: leader ? preferredName(leader.names) : "",
    leaderCount: leader?.count ?? 0,
    hasData: true,
  };
}

export async function getUserQuoteDayAnalytics(
  userId: string,
  day: string
): Promise<UserQuoteAnalytics> {
  const cleanDay = day.slice(0, 10);
  return getUserQuoteAnalyticsForDays(userId, cleanDay, cleanDay, [cleanDay]);
}

export async function getUserQuoteAnalytics(
  userId: string,
  year: number,
  month1: number
): Promise<UserQuoteAnalytics> {
  const month = String(month1).padStart(2, "0");
  const from = `${year}-${month}-01`;
  const days = new Date(year, month1, 0).getDate();
  const to = `${year}-${month}-${String(days).padStart(2, "0")}`;
  return getUserQuoteAnalyticsForDays(userId, from, to, dayKeysForMonth(year, month1));
}

export async function getUserQuoteMonthlyEvolution(
  userId: string,
  monthsBack = 6,
  now: Date = new Date()
): Promise<QuoteMonthPoint[]> {
  const base: { year: number; month1: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    base.push({ year: d.getFullYear(), month1: d.getMonth() + 1 });
  }
  const fallback = base.map((item) => ({
    ym: `${item.year}-${String(item.month1).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("es-CR", { month: "short" }).format(
      new Date(item.year, item.month1 - 1, 1)
    ),
    count: 0,
    crc: 0,
  }));

  try {
    const first = fallback[0]?.ym;
    const last = fallback[fallback.length - 1]?.ym;
    if (!first || !last) return fallback;
    const lastParts = last.split("-").map(Number);
    const lastDay = new Date(lastParts[0], lastParts[1], 0).getDate();
    const { data } = await createAdminClient()
      .from("cpi_quotes")
      .select("fecha, moneda, subtotal")
      .eq("user_id", userId)
      .gte("fecha", dayStart(`${first}-01`))
      .lte("fecha", dayEnd(`${last}-${String(lastDay).padStart(2, "0")}`))
      .limit(50000);
    const byMonth = new Map<string, { count: number; crc: number }>();
    for (const row of (data ?? []) as { fecha: string | null; moneda: string; subtotal: number }[]) {
      const ym = (row.fecha || "").slice(0, 7);
      if (!ym) continue;
      const current = byMonth.get(ym) ?? { count: 0, crc: 0 };
      current.count += 1;
      if (row.moneda !== "USD") current.crc += Number(row.subtotal) || 0;
      byMonth.set(ym, current);
    }
    return fallback.map((item) => {
      const current = byMonth.get(item.ym) ?? { count: 0, crc: 0 };
      return { ...item, ...current };
    });
  } catch {
    return fallback;
  }
}

async function getQuoteVendorPerformanceForDays(
  fromDay: string,
  toDay: string,
  dayKeys: string[]
): Promise<QuoteVendorPerformance> {
  const empty: QuoteVendorPerformance = {
    vendors: [],
    totalCRC: 0,
    totalUSD: 0,
    count: 0,
    clientes: 0,
    productos: 0,
    lineas: 0,
    activeDays: 0,
    porDia: dayKeys.map((day) => ({
      day,
      count: 0,
      crc: 0,
      usd: 0,
      vendors: 0,
      clientes: 0,
      productos: 0,
      lineas: 0,
      leader: "",
      leaderCount: 0,
    })),
    topProducts: [],
    hasData: false,
  };
  if (!fromDay || !toDay || fromDay > toDay) return empty;

  let quotes: QuoteDbRow[] = [];
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("cpi_quotes")
      .select(
        "id, cpi_key, cpi_id, quote_number, tipo, fecha, origen, sucursal, sucursal_code, point_of_sale_code, vendedor, vendedor_cod, cliente, cliente_id, medio_pago, moneda, subtotal, estado, actividad, user_id"
      )
      .gte("fecha", dayStart(fromDay))
      .lte("fecha", dayEnd(toDay))
      .limit(50000);
    quotes = (data ?? []) as QuoteDbRow[];
  } catch {
    return empty;
  }
  if (quotes.length === 0) return empty;

  const ignored = await fetchIgnoredVendors();
  const usableQuotes = quotes.filter((quote) => !ignored.has(quote.vendedor || ""));
  if (usableQuotes.length === 0) return empty;

  const lines = await fetchQuoteLines(usableQuotes.map((quote) => quote.cpi_key));
  const quoteByKey = new Map(usableQuotes.map((quote) => [quote.cpi_key, quote]));
  type ProductAgg = {
    descripcion: string;
    sku: string;
    quotes: Set<string>;
    cantidad: number;
    crc: number;
    usd: number;
  };
  type VendorAgg = {
    vendedor: string;
    count: number;
    crc: number;
    usd: number;
    crcCount: number;
    clientes: Set<string>;
    productos: Set<string>;
    days: Map<string, number>;
    lineas: number;
    products: Map<string, ProductAgg>;
  };

  const vendors = new Map<string, VendorAgg>();
  const companyClients = new Set<string>();
  const companyProducts = new Map<string, ProductAgg>();
  const companyDays = new Set<string>();
  const daily = new Map<string, {
    day: string;
    count: number;
    crc: number;
    usd: number;
    vendors: Set<string>;
    clientes: Set<string>;
    productos: Set<string>;
    lineas: number;
    vendorCounts: Map<string, number>;
  }>();
  let totalCRC = 0;
  let totalUSD = 0;

  const ensureVendor = (name: string) => {
    const key = name || "-";
    const agg =
      vendors.get(key) ??
      {
        vendedor: key,
        count: 0,
        crc: 0,
        usd: 0,
        crcCount: 0,
        clientes: new Set<string>(),
        productos: new Set<string>(),
        days: new Map<string, number>(),
        lineas: 0,
        products: new Map<string, ProductAgg>(),
      };
    vendors.set(key, agg);
    return agg;
  };
  const ensureDay = (day: string) => {
    const agg =
      daily.get(day) ??
      {
        day,
        count: 0,
        crc: 0,
        usd: 0,
        vendors: new Set<string>(),
        clientes: new Set<string>(),
        productos: new Set<string>(),
        lineas: 0,
        vendorCounts: new Map<string, number>(),
      };
    daily.set(day, agg);
    return agg;
  };

  for (const quote of usableQuotes) {
    const agg = ensureVendor(quote.vendedor);
    const amount = Number(quote.subtotal) || 0;
    const isUSD = quote.moneda === "USD";
    if (isUSD) {
      agg.usd += amount;
      totalUSD += amount;
    } else {
      agg.crc += amount;
      agg.crcCount += 1;
      totalCRC += amount;
    }
    agg.count += 1;
    if (quote.cliente) {
      agg.clientes.add(quote.cliente);
      companyClients.add(quote.cliente);
    }
    const day = (quote.fecha || "").slice(0, 10);
    if (day) {
      const dayAgg = ensureDay(day);
      dayAgg.count += 1;
      dayAgg.crc += isUSD ? 0 : amount;
      dayAgg.usd += isUSD ? amount : 0;
      dayAgg.vendors.add(quote.vendedor || "-");
      dayAgg.vendorCounts.set(
        quote.vendedor || "-",
        (dayAgg.vendorCounts.get(quote.vendedor || "-") ?? 0) + 1
      );
      if (quote.cliente) dayAgg.clientes.add(quote.cliente);
      companyDays.add(day);
      agg.days.set(day, (agg.days.get(day) ?? 0) + 1);
    }
  }

  const bumpProduct = (
    map: Map<string, ProductAgg>,
    line: QuoteLineDbRow,
    quote: QuoteDbRow
  ) => {
    const desc = (line.descripcion || "").trim();
    if (!desc) return "";
    const key = productKey(desc, line.sku);
    const agg =
      map.get(key) ??
      {
        descripcion: desc,
        sku: line.sku || "",
        quotes: new Set<string>(),
        cantidad: 0,
        crc: 0,
        usd: 0,
      };
    const total = Number(line.total_con_impuesto || line.total || line.subtotal) || 0;
    agg.quotes.add(line.cpi_key);
    agg.cantidad += Number(line.cantidad) || 0;
    if (quote.moneda === "USD") agg.usd += total;
    else agg.crc += total;
    map.set(key, agg);
    return key;
  };

  let lineas = 0;
  for (const line of lines) {
    const quote = quoteByKey.get(line.cpi_key);
    if (!quote) continue;
    const agg = ensureVendor(quote.vendedor);
    lineas += 1;
    agg.lineas += 1;
    const productId = bumpProduct(agg.products, line, quote);
    bumpProduct(companyProducts, line, quote);
    if (productId) agg.productos.add(productId);
    const day = (quote.fecha || "").slice(0, 10);
    if (day) {
      const dayAgg = ensureDay(day);
      dayAgg.lineas += 1;
      if (productId) dayAgg.productos.add(productId);
    }
  }

  const companyCount = usableQuotes.length;
  const list = [...vendors.values()].map((agg) => {
    const bestDay =
      [...agg.days.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
      null;
    const valor = agg.crc + agg.usd * USD_RATE;
    return {
      vendedor: agg.vendedor,
      count: agg.count,
      crc: agg.crc,
      usd: agg.usd,
      valor,
      ticketCRC: agg.crcCount ? Math.round(agg.crc / agg.crcCount) : 0,
      clientes: agg.clientes.size,
      productos: agg.productos.size,
      lineas: agg.lineas,
      activeDays: agg.days.size,
      bestDay,
      sharePct: companyCount ? Math.round((agg.count / companyCount) * 1000) / 10 : 0,
      topProducts: toVendorProducts(agg.products),
    };
  });
  list.sort((a, b) => b.count - a.count || b.valor - a.valor || a.vendedor.localeCompare(b.vendedor));
  const porDia: QuoteVendorDay[] = dayKeys.map((day) => {
    const agg = daily.get(day);
    if (!agg) {
      return {
        day,
        count: 0,
        crc: 0,
        usd: 0,
        vendors: 0,
        clientes: 0,
        productos: 0,
        lineas: 0,
        leader: "",
        leaderCount: 0,
      };
    }
    const leaderEntry = [...agg.vendorCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
    )[0];
    return {
      day,
      count: agg.count,
      crc: agg.crc,
      usd: agg.usd,
      vendors: agg.vendors.size,
      clientes: agg.clientes.size,
      productos: agg.productos.size,
      lineas: agg.lineas,
      leader: leaderEntry?.[0] ?? "",
      leaderCount: leaderEntry?.[1] ?? 0,
    };
  });

  return {
    vendors: list.map((vendor, index) => ({ ...vendor, rank: index + 1 })),
    totalCRC,
    totalUSD,
    count: companyCount,
    clientes: companyClients.size,
    productos: companyProducts.size,
    lineas,
    activeDays: companyDays.size,
    porDia,
    topProducts: toVendorProducts(companyProducts),
    hasData: list.length > 0,
  };
}

export async function getQuoteVendorDayPerformance(
  day: string
): Promise<QuoteVendorPerformance> {
  const cleanDay = day.slice(0, 10);
  return getQuoteVendorPerformanceForDays(cleanDay, cleanDay, [cleanDay]);
}

export async function getQuoteVendorRangePerformance(
  fromDay: string,
  toDay: string
): Promise<QuoteVendorPerformance> {
  const from = fromDay.slice(0, 10);
  const to = toDay.slice(0, 10);
  return getQuoteVendorPerformanceForDays(from, to, dayKeysForRange(from, to));
}

export async function getQuoteVendorPerformance(
  year: number,
  month1: number
): Promise<QuoteVendorPerformance> {
  const from = `${year}-${String(month1).padStart(2, "0")}-01`;
  const days = new Date(year, month1, 0).getDate();
  const to = `${year}-${String(month1).padStart(2, "0")}-${String(days).padStart(2, "0")}`;
  return getQuoteVendorPerformanceForDays(from, to, dayKeysForMonth(year, month1));
}
