// Sincroniza el INVENTARIO de CPI (por sucursal) hacia Supabase.
// Corre en TU computadora: CPI bloquea las IP de Vercel.
//
//   node scripts/sync-cpi-inventory.mjs
//   node scripts/sync-cpi-inventory.mjs --debug        -> guarda cpi-inv-*.html
//   node scripts/sync-cpi-inventory.mjs --dry-run      -> no escribe en Supabase
//   node scripts/sync-cpi-inventory.mjs --sucursales="1=San Jose,2=Alajuela"
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
const REQUEST_TIMEOUT_MS = 60_000;
const BASE = (process.env.CPI_BASE_URL || "https://www.appcontadorcpi.com/gm/").replace(/\/*$/, "/");
const USER = process.env.CPI_USER || "";
const PASS = process.env.CPI_PASS || "";
const ID = process.env.CPI_ID || "20";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SECRET_KEY || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function request(urlStr, { method = "GET", headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
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
    req.setTimeout(REQUEST_TIMEOUT_MS, () =>
      req.destroy(new Error(`CPI no respondio en ${REQUEST_TIMEOUT_MS / 1000}s`))
    );
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
  const pre = await request(`${BASE}Enter.php`, { headers: { referer: BASE } });
  for (const [k, v] of jarFrom(pre.headers["set-cookie"])) jar.set(k, v);

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
  if (DEBUG) writeFileSync("cpi-inv-login.html", res.body, "utf8");
  if (/AVISO DE BLOQUEO/i.test(res.body)) throw new Error("CPI bloqueó la petición (AVISO DE BLOQUEO).");
  if (!/Aplicaciones|Facturacion|Inventario/i.test(res.body)) throw new Error("El login no devolvió la app.");
  return { cookie: jarStr(jar), html: res.body };
}

const strip = (s) =>
  s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** Descubre las sucursales desde los <select> de la app. */
function discoverSucursales(html) {
  const found = new Map();
  const selects = html.match(/<select[^>]*>[\s\S]*?<\/select>/gi) || [];
  for (const sel of selects) {
    const name = (sel.match(/(?:name|id)\s*=\s*"([^"]*)"/i) || [])[1] || "";
    if (!/sucursal/i.test(name)) continue;
    for (const opt of sel.match(/<option[^>]*>[\s\S]*?<\/option>/gi) || []) {
      const value = (opt.match(/value\s*=\s*"([^"]*)"/i) || [])[1] ?? "";
      const label = strip(opt);
      if (!value || !label || /seleccion|todas|^--/i.test(label)) continue;
      if (!found.has(value)) found.set(value, label);
    }
  }
  return [...found].map(([code, label]) => ({ code, label }));
}

/** Paginas donde puede vivir el filtro de sucursales del modulo de inventario. */
const FILTER_PAGES = [
  "ControlItemsProdcInventarioFactConsultaReportes.php",
  "ItemsProdcInventarioFactConsultaReportes.php",
  "Page Main 4.php",
];

/** Intenta descubrir las sucursales pidiendo las paginas del modulo. */
async function discoverFromPages(cookie) {
  for (const page of FILTER_PAGES) {
    try {
      const body = new URLSearchParams({
        duser: USER,
        SocaaID: ID,
        idiomasistema: "Espanol",
      }).toString();
      const res = await request(`${BASE}${page}`, {
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
      if (DEBUG) writeFileSync(`cpi-inv-page-${page.replace(/[^a-z0-9]+/gi, "_")}.html`, res.body, "utf8");
      const found = discoverSucursales(res.body);
      if (found.length) {
        console.log(`  (sucursales detectadas en ${page})`);
        return found;
      }
    } catch {
      /* seguir con la siguiente pagina */
    }
  }
  return [];
}

/** Sucursales de CPI (codigos tomados del filtro "sucursalinventario"). */
const CPI_SUCURSALES = [
  { code: "001", label: "San Jose" },
  { code: "002", label: "Alajuela" },
  { code: "003", label: "Cartago" },
  { code: "004", label: "Heredia" },
  { code: "005", label: "BODEGA RMA" },
  { code: "006", label: "Puntarenas" },
  { code: "007", label: "Limon" },
  { code: "008", label: "San Carlos" },
  { code: "009", label: "Apartados" },
  { code: "020", label: "BARREAL" },
];

function sucursalesFromArgs() {
  const arg = process.argv.find((a) => a.startsWith("--sucursales="));
  if (!arg) return null;
  return arg
    .slice("--sucursales=".length)
    .split(",")
    .map((pair) => {
      const [code, ...rest] = pair.split("=");
      return { code: code.trim(), label: (rest.join("=") || code).trim() };
    })
    .filter((s) => s.code);
}

async function fetchInventory(cookie, sucursalCode) {
  const body = new URLSearchParams({
    duser: USER,
    str1: "", str2: "", str3: "", str4: "", str5: "",
    str6: "NO",
    str99: "30000",
    ordenar: "cdescripcion_esp ASC",
    moneda: "CRC",
    otros: "",
    familia: "",
    sucursales: sucursalCode || "",
    puntosventa: "",
    SocaaID: ID,
    idiomasistema: "",
  });
  for (const c of ["ccodigo", "cdescripcion_esp", "unidaddispo"]) body.append("columnas[]", c);
  const payload = body.toString();
  const res = await request(`${BASE}ControlSpecItemsProdcInventarioFactConsultaReportes.php`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": Buffer.byteLength(payload),
      "x-requested-with": "XMLHttpRequest",
      origin: new URL(BASE).origin,
      referer: `${BASE}Page Main 4.php`,
      ...(cookie ? { cookie } : {}),
    },
    body: payload,
  });
  if (DEBUG) writeFileSync(`cpi-inv-${sucursalCode || "todas"}.html`, res.body, "utf8");
  if (res.status >= 400) throw new Error(`Reporte de inventario HTTP ${res.status}`);
  return res.body;
}

/** Filas del reporte -> items. Detecta la cabecera ID/Codigo/Descripcion/Unidades. */
function parseInventory(html) {
  const rows = [];
  for (const chunk of html.split(/<tr[\s>]/i).slice(1)) {
    const row = chunk.split(/<\/tr>/i)[0];
    const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(strip);
    if (cells.length) rows.push(cells);
  }
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const idxOf = (cells, label) => cells.findIndex((c) => norm(c).includes(norm(label)));
  const headAt = rows.findIndex(
    (c) => idxOf(c, "codigo") >= 0 && idxOf(c, "descripcion") >= 0 && idxOf(c, "unidades") >= 0
  );
  if (headAt < 0) return [];
  const head = rows[headAt];
  const iId = idxOf(head, "id");
  const iSku = idxOf(head, "codigo");
  const iDesc = idxOf(head, "descripcion");
  const iQty = idxOf(head, "unidades");
  // CPI usa formato ingles: coma = miles, punto = decimales (ej. 1,234.50).
  const num = (s) => {
    const n = Number(String(s).replace(/[^\d.-]/g, "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const items = [];
  for (const cells of rows.slice(headAt + 1)) {
    const cpiId = iId >= 0 ? (cells[iId] || "").trim() : "";
    const sku = (cells[iSku] || "").trim();
    const descripcion = (cells[iDesc] || "").trim();
    if (!sku && !descripcion) continue;
    if (/^codigo$/i.test(sku)) continue;
    items.push({ cpiId, sku, descripcion, stockQty: num(cells[iQty] || "0") });
  }
  return items;
}

/** Prueba codigos de sucursal 1..N y reporta cuantos items devuelve cada uno.
 *  Sirve para descubrir los codigos reales sin tener que mirar la UI de CPI. */
async function probeSucursales(cookie, max = 12) {
  console.log(`Probando codigos de sucursal 1..${max} (esto tarda un poco)…`);
  const base = parseInventory(await fetchInventory(cookie, "")).length;
  console.log(`  (sin filtro) -> ${base} items`);
  for (let i = 1; i <= max; i++) {
    try {
      const n = parseInventory(await fetchInventory(cookie, String(i))).length;
      // Si la diferencia es minima, el filtro en realidad se esta ignorando.
      const dif = Math.abs(n - base);
      const nota =
        n === 0
          ? "vacio"
          : dif <= Math.max(5, base * 0.02)
            ? "practicamente igual (el filtro se ignora)"
            : "DISTINTO ✔ (el filtro si funciona)";
      console.log(`  codigo ${String(i).padStart(2)} -> ${String(n).padStart(5)} items   ${nota}`);
    } catch (e) {
      console.log(`  codigo ${i} -> error: ${e.message}`);
    }
  }
  console.log("\nSi algun codigo dice DISTINTO, ese filtro si funciona.");
  console.log('Usalo asi: node scripts/sync-cpi-inventory.mjs --sucursales="1=San Jose,2=Alajuela"');
}

async function main() {
  console.log("Iniciando sesión en CPI…");
  const { cookie, html } = await login();

  if (process.argv.includes("--probe")) {
    await probeSucursales(cookie);
    return;
  }

  let sucursales = sucursalesFromArgs() ?? CPI_SUCURSALES;
  if (sucursales.length === 0) {
    console.log("No se detectaron sucursales; se sincroniza el inventario general.");
    sucursales = [{ code: "", label: "Todas las sucursales" }];
  } else {
    console.log(`Sucursales detectadas: ${sucursales.map((s) => `${s.label} (${s.code})`).join(", ")}`);
  }

  // Map por clave: si CPI repite un item, se queda el ultimo (evita el error
  // "ON CONFLICT DO UPDATE command cannot affect row a second time").
  const byKey = new Map();
  let duplicados = 0;
  for (const suc of sucursales) {
    const items = parseInventory(await fetchInventory(cookie, suc.code));
    console.log(`  ${suc.label}: ${items.length} items`);
    for (const it of items) {
      const ident = it.cpiId || it.sku || it.descripcion;
      const key = `${suc.code}|${ident}`.slice(0, 200);
      if (byKey.has(key)) duplicados += 1;
      byKey.set(key, {
        cpi_key: key,
        sucursal_code: suc.code,
        sucursal: suc.label,
        cpi_id: it.cpiId,
        sku: it.sku,
        descripcion: it.descripcion,
        stock_qty: it.stockQty,
        synced_at: new Date().toISOString(),
      });
    }
  }
  const rows = [...byKey.values()];
  if (duplicados) console.log(`  (se unificaron ${duplicados} item(s) repetido(s))`);

  console.log(`Total: ${rows.length} filas de inventario.`);
  if (DRY_RUN) { console.log("--dry-run: no se escribió en Supabase."); return; }
  if (rows.length === 0) { console.log("Nada que guardar."); return; }
  if (!SB_URL || !SB_KEY) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");

  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  // El inventario es una foto del momento: se reemplaza completo.
  await sb.from("cpi_inventory").delete().neq("cpi_key", "");
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("cpi_inventory").upsert(rows.slice(i, i + 500), { onConflict: "cpi_key" });
    if (error) throw new Error("Supabase: " + error.message);
  }
  console.log(`Listo. ${rows.length} filas guardadas en cpi_inventory.`);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; });
