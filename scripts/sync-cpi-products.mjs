// Sincroniza el reporte CPI "Unidades vendidas" hacia Supabase.
// Se ejecuta localmente porque CPI solo acepta la IP autorizada de ICB.
//
//   node scripts/sync-cpi-products.mjs
//   node scripts/sync-cpi-products.mjs --from=2026-07-01 --to=2026-07-20
//   node scripts/sync-cpi-products.mjs --day=2026-07-20 --dry-run
import { readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    console.warn("No se encontro .env.local");
  }
}
loadEnv();

const DEBUG = process.argv.includes("--debug");
const DRY_RUN = process.argv.includes("--dry-run");
const REQUEST_TIMEOUT_MS = 45_000;
const TABLE = "cpi_product_sales_daily";
const BRANCH_TABLE = "cpi_product_sales_branch_daily";
const BASE = (process.env.CPI_BASE_URL || "https://www.appcontadorcpi.com/gm/").replace(/\/*$/, "/");
const USER = process.env.CPI_USER || "";
const PASS = process.env.CPI_PASS || "";
const ID = process.env.CPI_ID || "20";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SECRET_KEY || "";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || "";
}

function crToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(day, amount) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}

function daysInRange(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Las fechas deben usar el formato YYYY-MM-DD");
  }
  if (from > to) throw new Error("La fecha inicial no puede ser posterior a la final");
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  if (days.length > 62) throw new Error("El rango maximo es de 62 dias");
  return days;
}

function request(urlValue, { method = "GET", headers = {}, body = "" } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlValue, BASE);
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "es-CR,es;q=0.9,en;q=0.8",
          "accept-encoding": "identity",
          ...(body ? { "content-length": Buffer.byteLength(body) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode || 0, headers: res.headers, body: data })
        );
      }
    );
    req.on("error", reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`CPI no respondio en ${REQUEST_TIMEOUT_MS / 1000} segundos`));
    });
    if (body) req.write(body);
    req.end();
  });
}

function cookiesFrom(headers) {
  const raw = headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((cookie) => cookie.split(";")[0]).filter(Boolean);
}

function mergeCookies(...groups) {
  const jar = new Map();
  for (const group of groups) {
    for (const value of group) {
      const index = value.indexOf("=");
      if (index > 0) jar.set(value.slice(0, index), value.slice(index + 1));
    }
  }
  return [...jar].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function login() {
  if (!USER || !PASS || !ID) throw new Error("Faltan CPI_USER/CPI_PASS/CPI_ID en .env.local");
  const pre = await request("Enter.php", { headers: { referer: BASE } });
  const firstCookies = cookiesFrom(pre.headers);
  const body = new URLSearchParams({ Usuphp: USER, Passphp: PASS, SocaaID: ID }).toString();
  const response = await request("Page Main 4.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: new URL(BASE).origin,
      referer: `${BASE}Enter.php`,
      ...(firstCookies.length ? { cookie: mergeCookies(firstCookies) } : {}),
    },
    body,
  });
  const cookie = mergeCookies(firstCookies, cookiesFrom(response.headers));
  if (/AVISO DE BLOQUEO/i.test(response.body)) throw new Error("CPI bloqueo la peticion");
  if (/contrase.a o usuario incorrect|usuario o contrase.a incorrect/i.test(response.body)) {
    throw new Error("Usuario o contrasena incorrectos segun CPI");
  }
  if (!/Aplicaciones|Facturacion|Cerrar sesion|EXIT/i.test(response.body)) {
    throw new Error(`El login no devolvio la aplicacion (HTTP ${response.status})`);
  }
  return cookie;
}

function reportDate(day, endOfDay = false) {
  return `${day} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

async function fetchSoldProducts(cookie, day) {
  const params = new URLSearchParams({
    duser: USER,
    d: USER,
    e: "",
    f: "",
    g: "",
    h: "9999",
    i: "",
    j: "",
    k: reportDate(day),
    l: "",
    m: reportDate(day, true),
    n: "",
    str2: "Botonplacadorada",
    str3: "2",
    str14: "",
    str15: "fechamodifica DESC",
    str16: "",
    str17: "",
    str19: "SI",
    str20: "",
    str21: "",
    str23: "",
    str24: "",
    str25: process.env.CPI_ACTIVITY_CODES || "4741.0|4759.0",
    str27: process.env.CPI_TAX_TYPES || "0|1",
    otros: "",
    familia: "",
    SocaaID: ID,
    idiomasistema: "Espanol",
  });
  for (const source of ["RT", "RS"]) params.append("str18[]", source);
  for (const column of ["tipo", "origen", "sucursal", "vendedor", "estado"]) {
    params.append("str22[]", column);
  }
  const response = await request("ControlSpecFactUnidadesVendidas - Reportes.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(cookie ? { cookie } : {}),
    },
    body: params.toString(),
  });
  if (response.status >= 400 || /AVISO DE BLOQUEO/i.test(response.body)) {
    throw new Error(`El reporte de unidades vendidas fallo (HTTP ${response.status})`);
  }
  if (DEBUG) writeFileSync(`cpi-productos-${day}.html`, response.body, "utf8");
  return response.body;
}

async function fetchSoldItemsHtml(cookie, day) {
  const body = new URLSearchParams({
    duser: USER,
    d: USER,
    e: "",
    g: "",
    h: "5000",
    i: "",
    j: "",
    k: reportDate(day),
    l: "",
    m: reportDate(day, true),
    str2: "",
    str13: "",
    str14: "",
    str15: "Facturas.fec_factura DESC",
    str88: "reporte",
    str16: "FACTURADO",
    SocaaID: ID,
    idiomasistema: "Espanol",
  }).toString();
  const response = await request("ControlSpecFacturacionporitems.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
  if (response.status >= 400) throw new Error(`Reporte de facturación por items fallo (HTTP ${response.status})`);
  return response.body;
}

function decodeHtml(value) {
  const named = {
    amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
    aacute: "a", eacute: "e", iacute: "i", oacute: "o", uacute: "u",
    ntilde: "n", Aacute: "A", Eacute: "E", Iacute: "I", Oacute: "O",
    Uacute: "U", Ntilde: "N",
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => named[name] ?? match);
}

function cleanText(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  const negative = /^\s*\([\s\S]*\)\s*$/.test(value);
  const number = Number(value.replace(/[()]/g, "").replace(/[^\d.,-]/g, "").replace(/,/g, ""));
  const parsed = Number.isFinite(number) ? number : 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function currency(value) {
  return /dolar/i.test(normalize(value)) ? "USD" : /euro/i.test(normalize(value)) ? "EUR" : "CRC";
}

function parseReport(html) {
  const rows = (html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [])
    .map((row) => (row.match(/<(?:th|td)\b[\s\S]*?<\/(?:th|td)>/gi) || []).map(cleanText))
    .filter((cells) => cells.length > 0);
  const findColumn = (headers, label) => headers.findIndex((header) => normalize(header) === normalize(label));
  const headerAt = rows.findIndex(
    (cells) =>
      findColumn(cells, "Codigo") >= 0 &&
      findColumn(cells, "Descripcion") >= 0 &&
      findColumn(cells, "Unidades Total") >= 0
  );
  if (headerAt < 0) {
    if (/no se encontraron datos para los filtros seleccionados/i.test(cleanText(html))) {
      return [];
    }
    throw new Error("CPI no devolvio la tabla esperada de unidades vendidas");
  }
  const headers = rows[headerAt];
  const skuAt = findColumn(headers, "Codigo");
  const descriptionAt = findColumn(headers, "Descripcion");
  const currencyAt = findColumn(headers, "Moneda");
  const quantityAt = findColumn(headers, "Unidades Total");
  const salesAt = findColumn(headers, "Valor Venta Total");
  const costAt = findColumn(headers, "Costo Venta Total");
  const profitAt = findColumn(headers, "Utilidad Total");
  const stockAt = findColumn(headers, "Unid Disponibles");
  const products = [];
  for (const cells of rows.slice(headerAt + 1)) {
    const sku = (cells[skuAt] || "").trim();
    const descripcion = (cells[descriptionAt] || "").trim();
    if ((!sku && !descripcion) || /SUBTOTALES?|TOTALES?/i.test(descripcion)) continue;
    const cantidad = parseNumber(cells[quantityAt] || "0");
    if (!Number.isFinite(cantidad) || cantidad === 0) continue;
    products.push({
      sku,
      descripcion,
      moneda: currency(cells[currencyAt] || "CRC"),
      cantidad,
      totalVenta: parseNumber(cells[salesAt] || "0"),
      costoVenta: parseNumber(cells[costAt] || "0"),
      utilidad: parseNumber(cells[profitAt] || "0"),
      stockQty: stockAt >= 0 ? parseNumber(cells[stockAt] || "0") : null,
    });
  }
  return products;
}

function parseSoldInvoiceItems(html) {
  const rows = (html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [])
    .map((row) => (row.match(/<(?:th|td)\b[\s\S]*?<\/(?:th|td)>/gi) || []).map(cleanText))
    .filter((cells) => cells.length > 0);
  const findColumn = (headers, label) => headers.findIndex((header) => normalize(header) === normalize(label));
  const headerAt = rows.findIndex(
    (cells) =>
      findColumn(cells, "Factura") >= 0 &&
      findColumn(cells, "Origen") >= 0 &&
      findColumn(cells, "Item") >= 0 &&
      findColumn(cells, "Unidades") >= 0 &&
      findColumn(cells, "Total") >= 0
  );
  if (headerAt < 0) {
    if (/no se encontraron datos para los filtros seleccionados/i.test(cleanText(html))) return [];
    throw new Error("CPI no devolvio la tabla esperada de facturación por items");
  }
  const headers = rows[headerAt];
  const facturaAt = findColumn(headers, "Factura");
  const origenAt = findColumn(headers, "Origen");
  const puntoVentaAt = findColumn(headers, "Punto Venta");
  const fechaAt = findColumn(headers, "Fecha");
  const monedaAt = findColumn(headers, "Moneda");
  const skuAt = findColumn(headers, "Item");
  const cantidadAt = findColumn(headers, "Unidades");
  const precioAt = findColumn(headers, "Valor Unitario");
  const descuentoAt = findColumn(headers, "Descuentos");
  const totalAt = findColumn(headers, "Total");
  const items = [];
  for (const cells of rows.slice(headerAt + 1)) {
    const factura = (cells[facturaAt] || "").trim();
    const sku = (cells[skuAt] || "").trim();
    const cantidad = parseNumber(cells[cantidadAt] || "0");
    if (!factura || !sku || !Number.isFinite(cantidad) || cantidad === 0) continue;
    items.push({
      factura,
      origen: (cells[origenAt] || "").trim(),
      puntoVenta: (cells[puntoVentaAt] || "").trim(),
      fecha: (cells[fechaAt] || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || "",
      moneda: currency(cells[monedaAt] || "CRC"),
      sku,
      cantidad,
      precioUnit: parseNumber(cells[precioAt] || "0"),
      descuento: parseNumber(cells[descuentoAt] || "0"),
      total: parseNumber(cells[totalAt] || "0"),
    });
  }
  return items;
}

function productKey(sku, description) {
  return normalize(sku || description).slice(0, 180);
}

function mergeProducts(products) {
  const merged = new Map();
  for (const product of products) {
    const key = `${product.moneda}|${productKey(product.sku, product.descripcion)}`;
    if (!key.split("|")[1]) continue;
    const current = merged.get(key);
    if (!current) merged.set(key, { ...product });
    else {
      current.cantidad += product.cantidad;
      current.totalVenta += product.totalVenta;
      current.costoVenta += product.costoVenta;
      current.utilidad += product.utilidad;
      current.stockQty = product.stockQty;
    }
  }
  return [...merged.values()];
}

// El reporte agregado de "Unidades vendidas" de CPI omite algunas líneas en
// dólares. El reporte por ítems sí trae cada factura con su moneda real, así
// que se usa como fuente de verdad para cantidades y montos del ranking global.
function productsFromInvoiceItems(items, reportProducts) {
  const metadata = new Map();
  for (const product of reportProducts) {
    const key = normalize(product.sku);
    if (key && !metadata.has(key)) metadata.set(key, product);
  }
  const merged = new Map();
  for (const item of items) {
    const skuKey = normalize(item.sku);
    if (!skuKey) continue;
    const key = `${item.moneda}|${skuKey}`;
    const source = metadata.get(skuKey);
    const current = merged.get(key) || {
      sku: item.sku,
      descripcion: source?.descripcion || item.sku,
      moneda: item.moneda,
      cantidad: 0,
      totalVenta: 0,
      costoVenta: 0,
      utilidad: 0,
      stockQty: source?.stockQty ?? null,
    };
    current.cantidad += item.cantidad;
    current.totalVenta += item.total;
    merged.set(key, current);
  }
  return [...merged.values()];
}

async function smartRange(sb) {
  const today = crToday();
  const day = argument("day");
  if (day) return { from: day, to: day };
  const fromArg = argument("from");
  const toArg = argument("to");
  if (fromArg || toArg) return { from: fromArg || toArg, to: toArg || fromArg };
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data, error } = await sb
    .from(TABLE)
    .select("sale_date")
    .gte("sale_date", monthStart)
    .lte("sale_date", today)
    .order("sale_date", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return { from: data?.[0]?.sale_date?.slice(0, 10) || monthStart, to: today };
}

async function saveDay(sb, day, products) {
  const merged = mergeProducts(products);
  const rows = merged.map((product) => ({
    cpi_key: `${day}|${product.moneda}|${productKey(product.sku, product.descripcion)}`,
    sale_date: day,
    sku: product.sku,
    descripcion: product.descripcion,
    moneda: product.moneda,
    cantidad: product.cantidad,
    total_venta: product.totalVenta,
    costo_venta: product.costoVenta,
    utilidad: product.utilidad,
    stock_qty: product.stockQty,
    synced_at: new Date().toISOString(),
  }));

  // Primero se guardan los datos nuevos. Solo despues se eliminan claves que
  // ya no aparecen, para no vaciar el dia si el proceso se interrumpe.
  if (rows.length > 0) {
    const { error } = await sb.from(TABLE).upsert(rows, { onConflict: "cpi_key" });
    if (error) throw new Error(`Supabase (guardar ${day}): ${error.message}`);
  }
  const { data: existing, error: readError } = await sb
    .from(TABLE)
    .select("cpi_key")
    .eq("sale_date", day);
  if (readError) throw new Error(`Supabase (leer ${day}): ${readError.message}`);
  const currentKeys = new Set(rows.map((row) => row.cpi_key));
  const stale = (existing || []).map((row) => row.cpi_key).filter((key) => !currentKeys.has(key));
  for (let index = 0; index < stale.length; index += 200) {
    const { error } = await sb.from(TABLE).delete().in("cpi_key", stale.slice(index, index + 200));
    if (error) throw new Error(`Supabase (limpiar ${day}): ${error.message}`);
  }
  return rows.length;
}

async function saveBranchProductSales(sb, day, items, products) {
  const descriptions = new Map();
  for (const product of products) {
    const key = normalize(product.sku);
    if (key && product.descripcion) descriptions.set(key, product.descripcion);
  }

  const merged = new Map();
  for (const item of items) {
    const skuKey = normalize(item.sku);
    const origen = item.origen || "Sin sucursal";
    const puntoVenta = item.puntoVenta || "Sin punto de venta";
    const key = `${item.moneda}|${normalize(origen)}|${normalize(puntoVenta)}|${skuKey}`;
    const current = merged.get(key) || {
      sku: item.sku,
      descripcion: descriptions.get(skuKey) || item.sku,
      moneda: item.moneda,
      origen,
      punto_venta: puntoVenta,
      cantidad: 0,
      total_venta: 0,
    };
    current.cantidad += item.cantidad;
    current.total_venta += item.total;
    merged.set(key, current);
  }

  const rows = [...merged.values()].map((row) => {
    return {
      ...row,
      cpi_key: `${day}|${row.moneda}|${normalize(row.origen)}|${normalize(row.punto_venta)}|${productKey(row.sku, row.descripcion)}`,
      sale_date: day,
      synced_at: new Date().toISOString(),
    };
  });
  for (let index = 0; index < rows.length; index += 400) {
    const { error } = await sb.from(BRANCH_TABLE).upsert(rows.slice(index, index + 400), { onConflict: "cpi_key" });
    if (error) throw new Error(`Supabase (guardar productos por sucursal ${day}): ${error.message}`);
  }
  const { data: existing, error: readError } = await sb
    .from(BRANCH_TABLE)
    .select("cpi_key")
    .eq("sale_date", day);
  if (readError) throw new Error(`Supabase (leer productos por sucursal ${day}): ${readError.message}`);
  const currentKeys = new Set(rows.map((row) => row.cpi_key));
  const stale = (existing || []).map((row) => row.cpi_key).filter((key) => !currentKeys.has(key));
  for (let index = 0; index < stale.length; index += 200) {
    const { error } = await sb.from(BRANCH_TABLE).delete().in("cpi_key", stale.slice(index, index + 200));
    if (error) throw new Error(`Supabase (limpiar productos por sucursal ${day}): ${error.message}`);
  }
  return rows.length;
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  const results = new Array(items.length);
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  if (!SB_URL || !SB_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY en .env.local");
  }
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  const range = await smartRange(sb);
  const days = daysInRange(range.from, range.to);
  console.log(`Productos vendidos CPI: ${range.from} a ${range.to} (${days.length} dia(s))`);
  console.log("Iniciando sesion en CPI...");
  const cookie = await login();
  console.log("Sesion OK. Descargando productos y líneas por sucursal...");
  const daily = await mapLimit(days, 2, async (day) => {
    const products = parseReport(await fetchSoldProducts(cookie, day));
    const items = parseSoldInvoiceItems(await fetchSoldItemsHtml(cookie, day));
    const invoiceProducts = productsFromInvoiceItems(items, products);
    const usdLines = items.filter((item) => item.moneda === "USD").length;
    console.log(`  ${day}: ${invoiceProducts.length} producto(s), ${items.length} línea(s), ${usdLines} línea(s) USD`);
    return { day, products, invoiceProducts, items };
  });

  if (DRY_RUN) {
    console.log("Dry-run: no se guardo nada en Supabase.");
    console.log(JSON.stringify({
      from: range.from,
      to: range.to,
      days: daily.length,
      products: daily.reduce((sum, item) => sum + item.invoiceProducts.length, 0),
      invoiceLines: daily.reduce((sum, item) => sum + item.items.length, 0),
      usdInvoiceLines: daily.reduce(
        (sum, item) => sum + item.items.filter((line) => line.moneda === "USD").length,
        0
      ),
    }, null, 2));
    return;
  }

  let saved = 0;
  let savedByBranch = 0;
  for (const item of daily) {
    saved += await saveDay(sb, item.day, item.invoiceProducts);
    savedByBranch += await saveBranchProductSales(sb, item.day, item.items, item.products);
  }
  console.log(`Listo. ${saved} productos/día y ${savedByBranch} productos por sucursal guardados para ${daily.length} día(s).`);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
