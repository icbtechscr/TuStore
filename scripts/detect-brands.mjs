// Detecta la marca de cada producto a partir de su nombre y la asigna.
// Crea las marcas faltantes en la tabla `brands` y setea products.brand_id.
//
// Uso:
//   node --env-file=.env.local scripts/detect-brands.mjs --dry
//   node --env-file=.env.local scripts/detect-brands.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);
const DRY = process.argv.includes("--dry");

// Marcas con sus palabras clave (orden: más específicas primero).
const BRANDS = [
  { name: "Hikvision", match: ["hikvision"] },
  { name: "Dahua", match: ["dahua"] },
  { name: "IMOU", match: ["imou"] },
  { name: "Uniview", match: ["uniview"] },
  { name: "TP-Link", match: ["tp-link", "tplink"] },
  { name: "Ubiquiti", match: ["ubiquiti", "unifi", "airmax", "liteap", "u-poe"] },
  { name: "Ruijie", match: ["ruijie", "reyee"] },
  { name: "Cudy", match: ["cudy"] },
  { name: "Lantek", match: ["lantek"] },
  { name: "Teklink", match: ["teklink"] },
  { name: "X-Micro", match: ["x-micro", "xmicro"] },
  { name: "Forza", match: ["forza"] },
  { name: "CDP", match: ["cdp"] },
  { name: "EAST", match: ["east"] },
  { name: "APC", match: ["apc"] },
  { name: "Honeywell", match: ["honeywell"] },
  { name: "3nstar", match: ["3nstar"] },
  { name: "ZKTeco", match: ["zkteco"] },
  { name: "Epson", match: ["epson"] },
  { name: "Dell", match: ["dell"] },
  { name: "Apple", match: ["apple", "ipad", "iphone", "macbook", "airpods"] },
  { name: "Amazon", match: ["amazon", "alexa", "echo dot", "echo pop", "echo show"] },
  { name: "Kodak", match: ["kodak"] },
  { name: "Black+Decker", match: ["black+decker", "black & decker", "black and decker"] },
  { name: "Erickson", match: ["erick-son", "erickson"] },
  { name: "Oster", match: ["oster"] },
  { name: "Nova", match: ["nova"] },
  { name: "Kingston", match: ["kingston"] },
  { name: "Adata", match: ["adata"] },
  { name: "Logitech", match: ["logitech"] },
  { name: "Lenovo", match: ["lenovo"] },
  { name: "Samsung", match: ["samsung"] },
  { name: "Xiaomi", match: ["xiaomi"] },
  { name: "Seagate", match: ["seagate"] },
  { name: "Western Digital", match: ["western digital"] },
  { name: "Klip Xtreme", match: ["klip xtreme", "klipxtreme", "klip-xtreme"] },
  { name: "Vorago", match: ["vorago"] },
  { name: "Ezviz", match: ["ezviz"] },
  { name: "Mikrotik", match: ["mikrotik"] },
  { name: "Cyberpower", match: ["cyberpower"] },
];

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function detect(name) {
  const n = name.toLowerCase();
  for (const b of BRANDS) {
    for (const m of b.match) {
      const re = new RegExp(`(^|[^a-z0-9])${esc(m)}([^a-z0-9]|$)`, "i");
      if (re.test(n)) return b.name;
    }
  }
  return null;
}
function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // 1. Traer todos los productos
  let products = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data } = await sb
      .from("products")
      .select("id, name")
      .range(from, from + page - 1);
    if (!data || !data.length) break;
    products.push(...data);
    if (data.length < page) break;
    from += page;
  }

  const counts = {};
  const assignments = [];
  for (const p of products) {
    const brand = detect(p.name);
    if (brand) {
      counts[brand] = (counts[brand] || 0) + 1;
      assignments.push({ id: p.id, brand });
    }
  }
  console.log("Productos:", products.length, "| con marca detectada:", assignments.length);
  console.log("Distribución:", counts);

  if (DRY) {
    console.log("(dry-run, no se escribió nada)");
    return;
  }

  // 2. Crear/asegurar las marcas y mapear nombre -> id
  const usedBrands = [...new Set(assignments.map((a) => a.brand))];
  const brandId = {};
  for (const name of usedBrands) {
    const slug = slugify(name);
    const { data: existing } = await sb
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      brandId[name] = existing.id;
    } else {
      const { data, error } = await sb
        .from("brands")
        .insert({ name, slug })
        .select("id")
        .single();
      if (error) {
        console.warn("  ⚠ marca", name, error.message);
        continue;
      }
      brandId[name] = data.id;
    }
  }

  // 3. Asignar brand_id a cada producto
  let updated = 0;
  for (const a of assignments) {
    const bid = brandId[a.brand];
    if (!bid) continue;
    const { error } = await sb
      .from("products")
      .update({ brand_id: bid })
      .eq("id", a.id);
    if (!error) updated++;
  }
  console.log(`Marcas creadas/usadas: ${usedBrands.length} | productos actualizados: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
