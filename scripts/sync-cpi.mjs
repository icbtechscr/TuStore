// Sincroniza las ventas de CPI hacia Supabase, corriendo en TU computadora
// (usa tu IP de Costa Rica, que CPI sí acepta). Gratis, sin proxy.
// Usa el modulo https nativo (cookies confiables, sin el bug de undici en Windows).
//
//   node scripts/sync-cpi.mjs           -> sincroniza
//   node scripts/sync-cpi.mjs --from=2026-07-01 --to=2026-08-20
//   node scripts/sync-cpi.mjs --debug   -> guarda cpi-get/post/lista.html
//   node scripts/sync-cpi.mjs --dry-run -> consulta y parsea, sin escribir
import { readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { console.warn("No se encontró .env.local"); }
}
loadEnv();

const DEBUG = process.argv.includes("--debug");
const DRY_RUN = process.argv.includes("--dry-run");
const REQUEST_TIMEOUT_MS = 45_000;
const BASE = (process.env.CPI_BASE_URL || "https://www.appcontadorcpi.com/gm/").replace(/\/*$/, "/");
const USER = process.env.CPI_USER || "";
const PASS = process.env.CPI_PASS || "";
const ID = process.env.CPI_ID || "20";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SECRET_KEY || "";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// request() con https nativo. Devuelve { status, headers, body }.
function request(urlStr, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const opts = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search, // URL ya codifica los espacios como %20
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "es-CR,es;q=0.9,en;q=0.8",
        "accept-encoding": "identity",
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`CPI no respondio en ${REQUEST_TIMEOUT_MS / 1000} segundos`));
    });
    if (body) req.write(body);
    req.end();
  });
}

function jarFrom(setCookie) {
  const jar = new Map();
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const c of list) { const kv = c.split(";")[0]; const i = kv.indexOf("="); if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1)); }
  return jar;
}
const jarStr = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function login() {
  if (!USER || !PASS || !ID) throw new Error("Faltan CPI_USER/CPI_PASS/CPI_ID en .env.local");
  const jar = new Map();

  const pre = await request(`${BASE}Enter.php`, { headers: { referer: BASE } });
  for (const [k, v] of jarFrom(pre.headers["set-cookie"])) jar.set(k, v);
  if (DEBUG) { console.log("GET Enter.php ->", pre.status, "| cookies:", [...jar.keys()].join(",") || "(ninguna)"); writeFileSync("cpi-get.html", pre.body, "utf8"); }

  const body = new URLSearchParams({ Usuphp: USER, Passphp: PASS, SocaaID: ID }).toString();
  const res = await request(`${BASE}Page Main 4.php`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": Buffer.byteLength(body),
      origin: new URL(BASE).origin,
      referer: `${BASE}Enter.php`,
      ...(jar.size ? { cookie: jarStr(jar) } : {}),
    },
    body,
  });
  for (const [k, v] of jarFrom(res.headers["set-cookie"])) jar.set(k, v);
  if (DEBUG) { console.log("POST Page Main 4.php ->", res.status, "| cookies:", [...jar.keys()].join(",") || "(ninguna)"); writeFileSync("cpi-post.html", res.body, "utf8"); }

  if (/AVISO DE BLOQUEO/i.test(res.body)) throw new Error("CPI bloqueó la petición (AVISO DE BLOQUEO). Tu IP no fue aceptada.");
  if (/contrase.a o usuario incorrect|usuario o contrase.a incorrect/i.test(res.body)) throw new Error("Usuario o contraseña incorrectos según CPI.");
  // CPI no usa cookie de sesion: autentica por parametros (duser + SocaaID) en
  // cada llamada. Si el POST devolvio la app ("Aplicaciones"), el login sirvio.
  if (!/Aplicaciones|Facturacion|Cerrar sesion|EXIT/i.test(res.body)) {
    throw new Error(`El login no devolvio la app (GET ${pre.status}, POST ${res.status}). Revisá cpi-post.html.`);
  }
  return jarStr(jar); // puede ir vacio
}

// Reporte -> Facturacion FE (ControlSpecFacturacion - Reportes.php).
// Trae TODAS las facturas del rango de fechas (mes en curso) de todos los vendedores.
// Parametros capturados de la app real (str22[] = columnas, str23 = group by).
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

function requestedRange() {
  const today = crToday();
  const fromArg = argument("from");
  const toArg = argument("to");
  const from = fromArg || `${today.slice(0, 7)}-01`;
  const to = toArg || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Las fechas deben usar el formato YYYY-MM-DD");
  }
  if (from > to) throw new Error("La fecha inicial no puede ser posterior a la final");
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days > 62) throw new Error("El rango maximo es de 62 dias");
  return { from, to };
}

async function fetchReporte(cookie, range) {
  const desde = `${range.from} 00:00:00`;
  const hasta = `${range.to} 23:59:59`;

  const p = new URLSearchParams();
  const add = (k, v) => p.append(k, v);
  add("duser", USER); add("consolidado", "");
  add("d", USER); add("e", ""); add("f", ""); add("g", "");
  add("h", "9999"); add("i", ""); add("j", "");
  add("k", desde); add("l", ""); add("m", hasta); add("n", "");
  add("str2", "Botonplacadorada"); add("str3", "2"); add("str14", "");
  add("str15", "fechamodifica DESC"); add("str16", ""); add("str17", "");
  add("str20", ""); add("str21", "");
  for (const col of ["tipo", "origen", "sucursal", "vendedor", "cliente", "estado", "actividad", "baseimponible"]) {
    add("str22[]", col);
  }
  add("str23", " group by Facturas.cnum_factureal, Facturas.ind_tipfac,Detalles.cnum_factura");
  add("str25", "4741.0|4759.0"); add("str27", "0|1"); add("familia", "");
  add("SocaaID", ID); add("idiomasistema", "");
  const body = p.toString();

  const res = await request(`${BASE}ControlSpecFacturacion - Reportes.php`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": Buffer.byteLength(body),
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(cookie ? { cookie } : {}),
    },
    body,
  });
  if (DEBUG) writeFileSync("cpi-reporte.html", res.body, "utf8");
  if (res.status >= 400) {
    throw new Error(`El reporte fallo (HTTP ${res.status}). Revisá cpi-reporte.html.`);
  }
  const n = (res.body.match(/\d{4}-\d{2}-\d{2}/g) || []).length;
  console.log(`  Reporte ${desde.slice(0, 10)} a ${hasta.slice(0, 10)} -> ${res.status}, ${res.body.length} chars, ~${n} fechas`);
  if (n < 1) throw new Error("El reporte no devolvio facturas. Revisá cpi-reporte.html.");
  return res.body;
}
const strip = (s) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Parser del reporte "Facturacion FE". CPI cambia el orden de las columnas
// cuando se agregan campos al reporte, por eso se resuelven por encabezado.
function parse(html) {
  const out = [];
  const seen = new Set();
  const decodeEnt = (x) => (x || "")
    .replace(/&#162;|¢|₡|&#36;|\$/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  const money = (cell) => {
    const decoded = decodeEnt(String(cell));
    const negative = /^\s*\([\s\S]*\)\s*$/.test(decoded);
    const n = Number(decoded.replace(/[()]/g, "").replace(/[^\d.,-]/g, "").replace(/,/g, ""));
    if (!Number.isFinite(n)) return 0;
    return negative ? -Math.abs(n) : n;
  };
  const tableRows = (html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [])
    .map((row) => (row.match(/<(?:th|td)\b[\s\S]*?<\/(?:th|td)>/gi) || []).map(strip))
    .filter((cells) => cells.length > 0);
  const findColumn = (headers, label) => headers.findIndex((header) => norm(header) === norm(label));
  const headerAt = tableRows.findIndex((cells) =>
    findColumn(cells, "Fecha") >= 0 &&
    findColumn(cells, "Factura") >= 0 &&
    findColumn(cells, "Moneda") >= 0 &&
    findColumn(cells, "Total Comprobante") >= 0
  );
  if (headerAt < 0) throw new Error("CPI no devolvio las columnas esperadas del reporte de facturacion");
  const headers = tableRows[headerAt];
  const column = (label) => findColumn(headers, label);
  const typeAt = column("Tipo");
  const dateAt = column("Fecha");
  const invoiceAt = column("Factura");
  const originAt = column("Origen");
  const branchAt = column("Sucursal");
  const vendorAt = column("Vendedor");
  const clientAt = column("Cliente");
  const currencyAt = column("Moneda");
  const amountAt = column("Total Comprobante");
  const statusAt = column("Estado");
  const taxStatusAt = column("Respuesta Hacienda");

  for (const cells of tableRows.slice(headerAt + 1)) {
    const fechaM = (cells[dateAt] || "").match(/\d{4}-\d{2}-\d{2}/);
    if (!fechaM) continue;
    const fecha = fechaM[0];

    const tipo = cells[typeAt] || "Factura";
    const factura = cells[invoiceAt] || "";
    const origen = cells[originAt] || "";
    const sucursal = cells[branchAt] || "";
    const vendedor = cells[vendorAt] || "";
    let cliente = cells[clientAt] || "";
    const cm = cliente.match(/^\s*\d+\s*-\s*(.+)$/);
    if (cm) cliente = cm[1].trim();
    const monedaTxt = cells[currencyAt] || "";
    const moneda = /Dolar|Dólar/i.test(monedaTxt) ? "USD"
      : /Euro/i.test(monedaTxt) ? "EUR" : "CRC";
    const subtotal = money(cells[amountAt] || "0");
    const invoiceStatus = cells[statusAt] || "";
    const taxStatus = cells[taxStatusAt] || "";
    const estado = /ANULA/i.test(invoiceStatus)
      ? "ANULADA"
      : /RECHAZ/i.test(taxStatus)
        ? "RECHAZADA"
        : /ACEPT/i.test(taxStatus)
          ? "ACEPTADA"
          : (taxStatus || invoiceStatus).trim().toUpperCase();

    if (!factura) continue;
    const key = [tipo, factura, fecha].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      cpi_key: key, tipo, factura,
      fecha: `${fecha}T12:00:00`,
      origen, sucursal, vendedor, cliente, moneda,
      subtotal, estado,
    });
  }
  return out;
}

// Guarda filas en Supabase con el mapeo vendedor->usuario.
async function saveRows(rows, range) {
  if (rows.length === 0) { console.log("Sin filas para guardar."); return; }
  if (!SB_URL || !SB_KEY) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY en .env.local");
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  const { data: mapRows } = await sb.from("cpi_vendor_map").select("cpi_vendor, user_id");
  const map = new Map(); const pending = [];
  for (const r of mapRows || []) r.user_id ? map.set(r.cpi_vendor, r.user_id) : pending.push(r.cpi_vendor);
  if (pending.length) {
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byName = new Map();
    for (const u of list?.users || []) { const f = u.user_metadata?.full_name || ""; if (f) byName.set(norm(f), u.id); }
    for (const v of pending) { const uid = byName.get(norm(v)); if (uid) { map.set(v, uid); await sb.from("cpi_vendor_map").update({ user_id: uid }).eq("cpi_vendor", v); } }
  }
  const syncedAt = new Date().toISOString();
  for (const r of rows) {
    r.user_id = map.get(r.vendedor) || null;
    r.synced_at = syncedAt;
  }

  // El reporte es la fuente de verdad del mes. Primero hacemos upsert y solo
  // despues limpiamos claves obsoletas. Asi, una interrupcion conserva las
  // ventas que ya estaban visibles en vez de dejar el mes vacio.
  const rangeEnd = addDays(range.to, 1);
  const { data: existing, error: existingErr } = await sb
    .from("cpi_sales")
    .select("cpi_key")
    .gte("fecha", range.from)
    .lt("fecha", rangeEnd);
  if (existingErr) throw new Error("Supabase (leer rango): " + existingErr.message);

  const { error } = await sb.from("cpi_sales").upsert(rows, { onConflict: "cpi_key" });
  if (error) throw new Error("Supabase: " + error.message);

  const incomingKeys = new Set(rows.map((row) => row.cpi_key));
  const staleKeys = (existing || [])
    .map((row) => row.cpi_key)
    .filter((key) => !incomingKeys.has(key));
  const cleanupSafe = !existing?.length || rows.length >= Math.floor(existing.length * 0.8);
  if (!cleanupSafe) {
    console.warn(
      `Aviso: CPI devolvio ${rows.length} de ${existing.length} facturas existentes; se omite la limpieza por seguridad.`
    );
  } else {
    for (let i = 0; i < staleKeys.length; i += 200) {
      const { error: delErr } = await sb
        .from("cpi_sales")
        .delete()
        .in("cpi_key", staleKeys.slice(i, i + 200));
      if (delErr) throw new Error("Supabase (limpiar obsoletas): " + delErr.message);
    }
  }
  const matched = rows.filter((r) => r.user_id).length;
  console.log(
    `Listo. ${rows.length} facturas guardadas (${matched} ligadas a un usuario, ${cleanupSafe ? staleKeys.length : 0} obsoletas eliminadas).`
  );
}

function printDryRun(rows) {
  const days = [...new Set(rows.map((row) => row.fecha.slice(0, 10)))].sort();
  const latestDay = days.at(-1) || null;
  const latestCount = latestDay
    ? rows.filter((row) => row.fecha.startsWith(latestDay)).length
    : 0;
  console.log("Dry-run: no se guardo nada en Supabase.");
  const currencies = {};
  for (const row of rows) {
    const current = currencies[row.moneda] ?? { invoices: 0, amount: 0 };
    current.invoices += 1;
    current.amount += Number(row.subtotal) || 0;
    currencies[row.moneda] = current;
  }
  console.log(JSON.stringify({ rows: rows.length, latestDay, latestCount, days, currencies }, null, 2));
}

// Ruta del archivo a importar si se paso --import (o --import=RUTA).
function importPath() {
  const i = process.argv.findIndex((a) => a === "--import" || a.startsWith("--import="));
  if (i < 0) return null;
  const a = process.argv[i];
  if (a.includes("=")) return a.split("=").slice(1).join("=");
  return process.argv[i + 1] || null;
}

async function main() {
  const range = requestedRange();
  const imp = importPath();
  if (imp) {
    console.log("Importando facturas desde archivo:", imp);
    const html = readFileSync(imp, "utf8");
    const rows = parse(html);
    console.log(`Parseadas ${rows.length} facturas del archivo.`);
    if (rows.length === 0) { console.log("0 filas. ¿Es el HTML del reporte correcto?"); return; }
    if (DRY_RUN) { printDryRun(rows); return; }
    const importedDays = rows.map((row) => row.fecha.slice(0, 10)).sort();
    const importRange = argument("from") || argument("to")
      ? range
      : { from: importedDays[0], to: importedDays.at(-1) };
    await saveRows(rows, importRange);
    return;
  }

  console.log("Iniciando sesión en CPI…");
  const cookie = await login();
  console.log("Sesión OK. Descargando el reporte de facturación…");
  const html = await fetchReporte(cookie, range);
  const rows = parse(html);
  console.log(`Parseadas ${rows.length} facturas.`);
  if (rows.length === 0) { console.log("0 filas. Revisa cpi-reporte.html (corré con --debug)."); return; }
  if (DRY_RUN) { printDryRun(rows); return; }
  await saveRows(rows, range);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; });
