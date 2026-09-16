// Sincroniza cotizaciones CPI hacia Supabase, corriendo en esta computadora.
// Usa https nativo igual que sync-cpi.mjs para evitar bloqueos del sitio.
//
//   node scripts/sync-cpi-quotes.mjs --month=2026-07
//   node scripts/sync-cpi-quotes.mjs --from=2026-07-01 --to=2026-07-31
//   node scripts/sync-cpi-quotes.mjs --month=2026-07 --dry-run --limit=5
//   node scripts/sync-cpi-quotes.mjs --debug
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    console.warn("No se encontro .env.local");
  }
}
loadEnv();

const DEBUG = process.argv.includes("--debug");
const DRY_RUN = process.argv.includes("--dry-run");
const BASE = (process.env.CPI_BASE_URL || "https://www.appcontadorcpi.com/gm/").replace(/\/*$/, "/");
const USER = process.env.CPI_USER || "";
const PASS = process.env.CPI_PASS || "";
const ID = process.env.CPI_ID || "";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SECRET_KEY || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : "";
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayCr() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function rangeFromArgs() {
  const month = arg("month");
  const fromArg = arg("from");
  const toArg = arg("to");
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    return { from: `${month}-01`, to: `${month}-${pad(days)}` };
  }
  if (fromArg && toArg) return { from: fromArg.slice(0, 10), to: toArg.slice(0, 10) };
  const today = todayCr();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function request(urlStr, { method = "GET", headers = {}, body = "" } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr, BASE);
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "es-CR,es;q=0.9,en;q=0.8",
          "accept-encoding": "identity",
          ...headers,
          ...(body ? { "content-length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    req.setTimeout(45_000, () => {
      req.destroy(new Error("CPI no respondio en 45 segundos"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function jarFrom(setCookie) {
  const jar = new Map();
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const c of list) {
    const kv = c.split(";")[0];
    const i = kv.indexOf("=");
    if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1));
  }
  return jar;
}

const jarStr = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function login() {
  if (!USER || !PASS || !ID) throw new Error("Faltan CPI_USER/CPI_PASS/CPI_ID en .env.local");
  const jar = new Map();
  const pre = await request("Enter.php", { headers: { referer: BASE } });
  for (const [k, v] of jarFrom(pre.headers["set-cookie"])) jar.set(k, v);
  if (DEBUG) writeDebug("cpi-quotes-get.html", pre.body);

  const body = new URLSearchParams({ Usuphp: USER, Passphp: PASS, SocaaID: ID }).toString();
  const res = await request("Page Main 4.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: new URL(BASE).origin,
      referer: `${BASE}Enter.php`,
      ...(jar.size ? { cookie: jarStr(jar) } : {}),
    },
    body,
  });
  for (const [k, v] of jarFrom(res.headers["set-cookie"])) jar.set(k, v);
  if (DEBUG) writeDebug("cpi-quotes-post.html", res.body);

  if (/AVISO DE BLOQUEO/i.test(res.body)) throw new Error("CPI bloqueo la peticion (AVISO DE BLOQUEO).");
  if (/contrase.a o usuario incorrect|usuario o contrase.a incorrect/i.test(res.body)) {
    throw new Error("Usuario o contrasena incorrectos segun CPI.");
  }
  if (!/Aplicaciones|Facturacion|Facturaci\S*n|Cerrar sesion|EXIT/i.test(res.body)) {
    throw new Error(`El login no devolvio la app (GET ${pre.status}, POST ${res.status}).`);
  }
  return jarStr(jar);
}

function writeDebug(name, body) {
  mkdirSync("scripts", { recursive: true });
  writeFileSync(`scripts/${name}`, body, "utf8");
}

function ensureOk(res, label) {
  if (/AVISO DE BLOQUEO/i.test(res.body)) throw new Error(`CPI bloqueo ${label} (HTTP ${res.status}).`);
  if (res.status >= 400) {
    const sample = res.body.replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`${label} fallo (HTTP ${res.status}) - ${sample}`);
  }
}

async function fetchQuotesList(cookie, { from, to, limit }) {
  const p = new URLSearchParams({
    duser: USER,
    d: "",
    e: "",
    ee: "",
    f: "",
    ff: "",
    g: "",
    h: String(limit),
    i: "",
    j: "",
    str3: "",
    str10: "",
    str11: "",
    str12: "",
    str13: from,
    str14: to,
    str21: "",
    str22: "",
    str23: "",
    str24: "",
    str25: "",
    filtrocolor: "",
    SocaaID: ID,
    idiomasistema: "Español",
  });
  const res = await request("ControlSpecFactCotizaciones.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(cookie ? { cookie } : {}),
    },
    body: p.toString(),
  });
  if (DEBUG) writeDebug("cpi-quotes-list.html", res.body);
  ensureOk(res, "lista de cotizaciones");
  return res.body;
}

async function fetchQuoteDetail(cookie, quote) {
  const p = new URLSearchParams({
    Updated: "SI",
    eliminadefinitivo: "",
    duser: USER,
    d: "",
    e: quote.cpi_id,
    str3: "",
    SocaaID: ID,
    idiomasistema: "Español",
    str12: quote.sucursal_code,
    str13: quote.point_of_sale_code,
  });
  const res = await request("Gene New FactCotizaciones.php", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(cookie ? { cookie } : {}),
    },
    body: p.toString(),
  });
  ensureOk(res, `detalle ${quote.quote_number}`);
  return res.body;
}

function decodeHtml(s = "") {
  const named = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    apos: "'",
    cent: "¢",
    aacute: "á",
    eacute: "é",
    iacute: "í",
    oacute: "ó",
    uacute: "ú",
    ntilde: "ñ",
    Aacute: "Á",
    Eacute: "É",
    Iacute: "Í",
    Oacute: "Ó",
    Uacute: "Ú",
    Ntilde: "Ñ",
  };
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => named[name] ?? m);
}

function stripTags(s = "") {
  return decodeHtml(String(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function amount(s = "") {
  const n = Number(decodeHtml(String(s)).replace(/[^\d.,-]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function attr(tag = "", name) {
  const m = String(tag).match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return m ? decodeHtml(m[1]) : "";
}

function esc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inputValueByName(html, name) {
  const tag = String(html).match(new RegExp(`<input\\b[^>]*name=["']${esc(name)}["'][^>]*>`, "i"))?.[0] ?? "";
  return attr(tag, "value").trim();
}

function inputValues(html) {
  return (String(html).match(/<input\b[^>]*>/gi) ?? [])
    .map((tag) => attr(tag, "value").trim())
    .filter(Boolean);
}

function cells(row) {
  return String(row).match(/<td[\s\S]*?<\/td>/gi) ?? [];
}

function selectedOption(selectHtml) {
  const selected =
    String(selectHtml).match(/<option\b([^>]*)\bselected\b[^>]*>([\s\S]*?)<\/option>/i) ??
    String(selectHtml).match(/<option\b([^>]*)>([\s\S]*?)<\/option>/i);
  if (!selected) return { value: "", text: "" };
  return { value: attr(selected[1], "value"), text: stripTags(selected[2]) };
}

function parseCurrency(raw) {
  if (/Dolar|Dólar|DÃ³lar|\$/i.test(raw)) return "USD";
  if (/Euro/i.test(raw)) return "EUR";
  return "CRC";
}

function quoteKey(q) {
  return q.quote_number || q.cpi_id;
}

function parseQuotes(html) {
  const out = [];
  const rows = String(html).match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const seen = new Set();
  for (const row of rows) {
    if (!/numeroidctrlfacturacion/i.test(row) || !/COT-\d+/i.test(row)) continue;
    const td = cells(row);
    const quoteNumber =
      inputValues(td[2] ?? "").find((v) => /^COT-\d+/i.test(v)) ||
      inputValues(row).find((v) => /^COT-\d+/i.test(v)) ||
      "";
    const cpiId = inputValueByName(row, "numeroidctrlfacturacion");
    const key = quoteNumber || cpiId;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const originValues = inputValues(td[4] ?? "");
    const branchValues = inputValues(td[5] ?? "");
    const vendorValues = inputValues(td[6] ?? "");
    const clientValues = inputValues(td[10] ?? "");
    const currencyText = inputValues(td[11] ?? "").at(-1) ?? "";
    out.push({
      cpi_key: key,
      cpi_id: cpiId,
      quote_number: quoteNumber,
      tipo: inputValues(td[0] ?? "").at(-1) || "Cotizacion",
      fecha: `${(inputValueByName(row, "fechasearchfacturacion") || inputValues(td[3] ?? "").at(-1) || "").slice(0, 10)}T12:00:00-06:00`,
      origen: originValues.at(-1) ?? "",
      sucursal: branchValues.at(-1) ?? "",
      sucursal_code: inputValueByName(row, "sucursalsearchfacturacion") || originValues[0] || "",
      point_of_sale_code: inputValueByName(row, "puntoventasearchfacturacion") || branchValues[0] || "",
      vendedor: vendorValues.at(-1) ?? "",
      vendedor_cod: inputValueByName(row, "codidvendedorfacturacion"),
      cliente: clientValues.at(-1) ?? "",
      cliente_id: attr(row, "data-clienteid") || clientValues[0] || "",
      medio_pago: inputValues(td[9] ?? "").at(-1) ?? "",
      moneda: parseCurrency(currencyText),
      subtotal: amount(inputValues(td[12] ?? "").at(-1) ?? ""),
      estado: (row.match(/\b(ACEPTADA|RECHAZADA|PROCESANDO|PENDIENTE|PREFACTURA)\b/i)?.[1] ?? "").toUpperCase(),
      actividad: "",
      user_id: null,
    });
  }
  return out;
}

function parseLines(html, quote) {
  const indexes = new Set();
  const re = /name=["']lineadescripcion(\d+)facturacion["']/gi;
  let m;
  while ((m = re.exec(html))) indexes.add(Number(m[1]));

  const lines = [];
  for (const idx of [...indexes].sort((a, b) => a - b)) {
    const selectHtml =
      String(html).match(
        new RegExp(`<select\\b[^>]*name=["']lineaitem${idx}facturacion["'][\\s\\S]*?<\\/select>`, "i")
      )?.[0] ?? "";
    const selected = selectedOption(selectHtml);
    const selectedWithoutStock = selected.text.replace(/\s+-\s+Saldo:.*$/i, "").trim();
    const parts = selectedWithoutStock.split(/\s+-\s+/);
    const sku = parts[0] ?? "";
    const fallbackDescription = parts.length > 1 ? parts.slice(1).join(" - ") : selectedWithoutStock;
    const descripcion = inputValueByName(html, `lineadescripcion${idx}facturacion`) || fallbackDescription;
    if (!descripcion.trim() && !selected.value) continue;
    const subtotal =
      amount(inputValueByName(html, `lineasubtotal${idx}facturacion`)) ||
      amount(inputValueByName(html, `lineatotal${idx}facturacion`));
    lines.push({
      cpi_key: quoteKey(quote),
      quote_number: quote.quote_number,
      line_id: inputValueByName(html, `numeroidlinearelacionada${idx}facturacion`) || null,
      linea: Number(inputValueByName(html, `lineano${idx}facturacion`)) || idx,
      item_id: selected.value || null,
      sku: sku || null,
      descripcion: descripcion.trim(),
      cantidad: amount(inputValueByName(html, `lineacantidad${idx}facturacion`)),
      precio_unit: amount(inputValueByName(html, `lineavalorunitario${idx}facturacion`)),
      descuento: amount(inputValueByName(html, `lineadescuento${idx}facturacion`)),
      subtotal,
      impuesto: amount(inputValueByName(html, `lineaimpventas${idx}facturacion`)),
      total: amount(inputValueByName(html, `lineatotal${idx}facturacion`)) || subtotal,
      total_con_impuesto: amount(inputValueByName(html, `lineaconimpventastotal${idx}facturacion`)) || subtotal,
    });
  }
  return lines;
}

function norm(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveVendorMap(sb, vendors) {
  const unique = [...new Set(vendors.filter(Boolean))];
  if (unique.length) {
    await sb.from("cpi_vendor_map").upsert(unique.map((cpi_vendor) => ({ cpi_vendor })), {
      onConflict: "cpi_vendor",
    });
  }

  const { data: mapRows } = await sb.from("cpi_vendor_map").select("cpi_vendor, user_id");
  const map = new Map();
  const pending = [];
  for (const row of mapRows || []) row.user_id ? map.set(row.cpi_vendor, row.user_id) : pending.push(row.cpi_vendor);
  if (pending.length) {
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byName = new Map();
    for (const user of list?.users || []) {
      const full = user.user_metadata?.full_name || "";
      if (full) byName.set(norm(full), user.id);
    }
    for (const vendor of pending) {
      const userId = byName.get(norm(vendor));
      if (!userId) continue;
      map.set(vendor, userId);
      await sb.from("cpi_vendor_map").update({ user_id: userId }).eq("cpi_vendor", vendor);
    }
  }
  return map;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function saveQuotes(quotes, lines, { from, to }) {
  if (!SB_URL || !SB_KEY) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY en .env.local");
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  const vendorMap = await resolveVendorMap(sb, quotes.map((q) => q.vendedor));
  for (const q of quotes) q.user_id = vendorMap.get(q.vendedor) || null;

  const { error: delQuoteErr } = await sb
    .from("cpi_quotes")
    .delete()
    .gte("fecha", `${from}T00:00:00-06:00`)
    .lte("fecha", `${to}T23:59:59-06:00`);
  if (delQuoteErr) throw new Error("Supabase (limpiar cotizaciones): " + delQuoteErr.message);

  const { data: saved, error } = await sb.from("cpi_quotes").upsert(quotes, { onConflict: "cpi_key" }).select("id, cpi_key");
  if (error) throw new Error("Supabase (cotizaciones): " + error.message);
  const idByKey = new Map((saved || []).map((row) => [row.cpi_key, row.id]));
  const lineRows = lines.map((line) => ({ ...line, quote_id: idByKey.get(line.cpi_key) || null }));
  if (lineRows.length) {
    const { error: lineError } = await sb.from("cpi_quote_lines").insert(lineRows);
    if (lineError) throw new Error("Supabase (lineas): " + lineError.message);
  }
  return { saved: saved?.length || quotes.length, lines: lineRows.length, matched: quotes.filter((q) => q.user_id).length };
}

async function assertSupabaseReady() {
  if (!SB_URL || !SB_KEY) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY en .env.local");
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  for (const table of ["cpi_quotes", "cpi_quote_lines"]) {
    const { error } = await sb.from(table).select("id").limit(1);
    if (error) {
      throw new Error(
        `Falta la tabla ${table} en Supabase. Ejecuta primero supabase/cpi_quotes.sql en el SQL editor. Detalle: ${error.message}`
      );
    }
  }
}

async function main() {
  const range = rangeFromArgs();
  const limit = Math.max(1, Math.min(10000, Number(arg("limit") || 1000)));
  const concurrency = Math.max(1, Math.min(8, Number(arg("concurrency") || 4)));
  console.log(`Cotizaciones CPI ${range.from} a ${range.to} (limite ${limit})`);
  if (!DRY_RUN) await assertSupabaseReady();
  const cookie = await login();
  const listHtml = await fetchQuotesList(cookie, { ...range, limit });
  const quotes = parseQuotes(listHtml);
  console.log(`Cotizaciones encontradas: ${quotes.length}`);
  if (quotes.length === 0) {
    console.log("0 filas. Corre con --debug y revisa scripts/cpi-quotes-list.html");
    return;
  }

  const withLines = await mapLimit(quotes, concurrency, async (quote, idx) => {
    const detailHtml = await fetchQuoteDetail(cookie, quote);
    if (DEBUG && idx === 0) writeDebug("cpi-quotes-detail-sample.html", detailHtml);
    const quoteLines = parseLines(detailHtml, quote);
    process.stdout.write(".");
    return { quote, lines: quoteLines };
  });
  process.stdout.write("\n");
  const lines = withLines.flatMap((item) => item.lines);
  console.log(`Lineas encontradas: ${lines.length}`);
  if (DRY_RUN) {
    console.log("Dry-run: no se guardo nada en Supabase.");
    console.log(JSON.stringify({ sampleQuote: quotes[0], sampleLine: lines[0] || null }, null, 2));
    return;
  }
  const result = await saveQuotes(quotes, lines, range);
  console.log(`Listo. ${result.saved} cotizaciones y ${result.lines} lineas guardadas (${result.matched} ligadas a usuario).`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exitCode = 1;
});
