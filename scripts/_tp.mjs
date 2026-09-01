written
 readFileSync } from "node:fs";
const strip = (s) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const amount = (s) => { const n = Number(s.replace(/[^\d.,-]/g, "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function parse(html) {
  const out = [];
  const seen = new Set();
  const TIPOS = /(Factura exportacion|Nota Debito|Nota Credito|Tiquete|Apartado|Factura)/i;
  const decodeEnt = (x) => (x || "").replace(/&#162;/g, "").replace(/&#36;/g, "").replace(/&amp;/g, "&");
  const afterInput = (row, name) => {
    const m = row.match(new RegExp(name + '"[^>]*>\\s*([^<]+)', "i"));
    return m ? m[1].replace(/\s+/g, " ").trim() : "";
  };
  const chunks = html.split(/<tr[\s>]/i).slice(1);
  for (const raw of chunks) {
    const row = raw.split(/<\/tr>/i)[0];
    if (!/(ACEPTADA|RECHAZADA|PROCESAN|PENDIENTE)/i.test(row)) continue;
    const fecha = row.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
    if (!fecha) continue;

    const byName = {}; const values = [];
    for (const inp of row.match(/<input[^>]*>/gi) || []) {
      const nm = (inp.match(/name="([^"]*)"/i) || [])[1];
      const vl = (inp.match(/value="([^"]*)"/i) || [])[1];
      if (vl != null) values.push(vl);
      if (nm && byName[nm] === undefined) byName[nm] = vl;
    }

    const montoRaw = values.find((v) => /(&#162;|&#36;|¢|\$|₡)\s?\d/.test(v || "")) || "0";
    const monedaVal = values.find((v) => /^(Colones|Dolares|Dólares|Euros)$/i.test(v || "")) || "";
    const moneda = /Dolar|Dólar|\$|&#36;/i.test(monedaVal + montoRaw) ? "USD"
      : /Euro/i.test(monedaVal) ? "EUR" : "CRC";
    const estado = /ACEPTADA/i.test(row) ? "ACEPTADA"
      : /RECHAZADA/i.test(row) ? "RECHAZADA"
      : /PROCESAN/i.test(row) ? "PROCESANDO" : "PENDIENTE";
    const tipoM = row.match(TIPOS);
    const factura = byName["numeroclickctrlfacturacion"] || "";
    const clave = byName["clavenumelineafacturacion"] || (row.match(/\b(\d{40,60})\b/) || [])[1] || "";
    const vendedor = afterInput(row, "codidvendedorfacturacion");
    const origen = afterInput(row, "sucursalsearchfacturacion");
    const sucursal = afterInput(row, "puntoventasearchfacturacion");
    let cliente = "";
    for (const inp of row.match(/<input[^>]*numeroclickctrlconsgprove[^>]*>/gi) || []) {
      const vl = (inp.match(/value="([^"]*)"/i) || [])[1] || "";
      if (vl && !/^\d+$/.test(vl)) { cliente = vl; break; }
    }

    const key = clave || [factura, fecha[0]].join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      cpi_key: key, tipo: tipoM ? tipoM[1] : "Factura", factura,
      fecha: `${fecha[1]}T${fecha[2]}`,
      origen, sucursal, vendedor, cliente, moneda,
      subtotal: amount(decodeEnt(montoRaw)), estado,
    });
  }
  return out;
}async function main() {
  console.log("Ingresando a CPI…");
  const cookie = await login();
  console.log("Sesión OK. Descargando facturas…");
  const html = await fetchCompletadas(cookie);
  const rows = parse(html);
  console.log(`Facturas leídas: ${rows.length}`);
  if (rows.length === 0) { console.log("0 filas. Revisá cpi-lista.html (corré con --debug)."); return; }
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
  for (const r of rows) r.user_id = map.get(r.vendedor) || null;

  const { error } = await sb.from("cpi_sales").upsert(rows, { onConflict: "cpi_key" });
  if (error) throw new Error("Supabase: " + error.message);
  const matched = rows.filter((r) => r.user_id).length;
  console.log(`Listo. ${rows.length} facturas guardadas (${matched} ligadas a un usuario).`);
}

const html = readFileSync("cpi-control.html","utf8");
const rows = parse(html);
console.log("TOTAL:", rows.length);
for (const r of rows.slice(0,4)) console.log(JSON.stringify(r));
const suma = rows.filter(r=>r.moneda==='CRC').reduce((a,r)=>a+r.subtotal,0);
console.log("suma CRC:", suma, "| vendedores:", [...new Set(rows.map(r=>r.vendedor))].slice(0,6));
