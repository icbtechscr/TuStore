// Migra multimedia de WordPress/ICB al Storage propio de TuStore.
// Se ejecuta dentro del contenedor de TuStore (usa sus variables de entorno).
import fs from "node:fs/promises";

const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const secret = process.env.SUPABASE_SECRET_KEY || "";
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "imagenes";
const currentPrefix = `${base}/storage/v1/object/public/${bucket}/`;
const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
if (!base || !secret) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY");

const jsonHeaders = { ...headers, "content-type": "application/json" };
const snapshot = JSON.parse(await fs.readFile("/app/data/tustore-woo-snapshot.json", "utf8"));
const sources = new Set();
const walk = (value, key = "") => {
  if (key === "src" && typeof value === "string" && /^https?:\/\//i.test(value)) sources.add(value);
  else if (Array.isArray(value)) value.forEach((item) => walk(item));
  else if (value && typeof value === "object") Object.entries(value).forEach(([k, v]) => walk(v, k));
};
walk(snapshot);

async function getRows() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${base}/rest/v1/product_images?select=id,url&limit=1000&offset=${offset}`, { headers });
    if (!response.ok) throw new Error(`No se pudo leer product_images (${response.status})`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
const dbRows = await getRows();
for (const row of dbRows) if (row.url) sources.add(row.url);

function objectKey(url) {
  const parsed = new URL(url);
  if (parsed.pathname.startsWith("/wp-content/uploads/")) return safeKey(parsed.pathname.slice(1));
  const marker = "/storage/v1/object/public/";
  const at = parsed.pathname.indexOf(marker);
  if (at >= 0) {
    const rest = parsed.pathname.slice(at + marker.length).split("/");
    rest.shift(); // bucket anterior
    return safeKey(rest.map(decodeURIComponent).join("/"));
  }
  return null;
}
function safeKey(key) {
  return key.split("/").map((segment) => segment.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_")).join("/");
}
function encodedKey(key) { return key.split("/").map(encodeURIComponent).join("/"); }
function migratedUrl(key) { return `${currentPrefix}${encodedKey(key)}`; }

async function migrateOne(source) {
  if (source.startsWith(currentPrefix)) return { source, target: source, skipped: true };
  let parsed;
  try { parsed = new URL(source); } catch { return { source, target: source, skipped: true }; }
  const key = objectKey(source);
  if (!key) return { source, target: source, skipped: true };
  const downloadUrl = parsed.pathname.startsWith("/wp-content/uploads/")
    ? `https://mail.tustorecr.com${parsed.pathname}${parsed.search}`
    : parsed.hostname.includes("supabase-icb-pruebas")
      ? `http://supabase-kong:8000${parsed.pathname}${parsed.search}`
      : source;
  const file = await fetch(downloadUrl);
  if (!file.ok) throw new Error(`descarga ${file.status}`);
  const bytes = await file.arrayBuffer();
  const contentType = file.headers.get("content-type") || "application/octet-stream";
  const upload = await fetch(`${base}/storage/v1/object/${bucket}/${encodedKey(key)}`, {
    method: "POST",
    headers: { ...headers, "content-type": contentType, "x-upsert": "true" },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`subida ${upload.status}: ${await upload.text()}`);
  return { source, target: migratedUrl(key), skipped: false };
}

const entries = [...sources];
const mapping = new Map();
const errors = [];
let next = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= entries.length) return;
    try { mapping.set(entries[i], (await migrateOne(entries[i])).target); }
    catch (error) { errors.push({ source: entries[i], error: String(error?.message || error) }); }
    if ((i + 1) % 100 === 0) console.log(`Procesadas ${i + 1}/${entries.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

let updated = 0;
for (const row of dbRows) {
  const target = mapping.get(row.url);
  if (!target || target === row.url) continue;
  const response = await fetch(`${base}/rest/v1/product_images?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH", headers: jsonHeaders, body: JSON.stringify({ url: target }),
  });
  if (!response.ok) errors.push({ source: row.url, error: `actualización DB ${response.status}` });
  else updated++;
}
await fs.writeFile("/tmp/tustore-media-map.json", JSON.stringify(Object.fromEntries(mapping), null, 2));
console.log(JSON.stringify({ sources: entries.length, dbRows: dbRows.length, updated, errors: errors.length }));
if (errors.length) {
  await fs.writeFile("/tmp/tustore-media-errors.json", JSON.stringify(errors, null, 2));
  process.exitCode = 2;
}
