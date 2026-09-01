// Respaldo de seguridad de Supabase (datos + usuarios de Auth) a JSON.
// Uso: node scripts/backup-supabase.mjs
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de .env.local
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}
loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const TABLES = [
  "brands", "categories", "product_categories", "product_images", "products",
  "orders", "order_items", "site_settings",
  "cpi_sales", "cpi_sale_lines", "cpi_product_sales_daily",
  "cpi_quotes", "cpi_quote_lines", "cpi_vendor_map",
  "time_entries", "vacation_requests",
  "push_subscriptions", "vendor_fb_connections", "vendor_posts",
];

const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const dir = new URL(`../backups/${stamp}/`, import.meta.url);
mkdirSync(dir, { recursive: true });

async function dumpTable(name) {
  const all = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(name).select("*").range(from, from + page - 1);
    if (error) { console.log(`  ${name}: ERROR ${error.message}`); return null; }
    all.push(...data);
    if (data.length < page) break;
  }
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(all, null, 2));
  console.log(`  ${name}: ${all.length} filas`);
  return all.length;
}

async function dumpUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.log(`  auth.users: ERROR ${error.message}`); return null; }
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }
  writeFileSync(new URL(`auth-users.json`, dir), JSON.stringify(all, null, 2));
  console.log(`  auth.users: ${all.length} usuarios`);
  return all.length;
}

console.log(`Respaldando Supabase -> backups/${stamp}/`);
console.log("Usuarios de Auth:");
await dumpUsers();
console.log("Tablas:");
for (const t of TABLES) await dumpTable(t);
console.log("Listo. Respaldo guardado en la carpeta backups/.");
