// Diagnóstico de solo lectura de la aplicación TuStore.
// No imprime valores de variables, usuarios ni credenciales.
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SITE_ORIGIN",
];

const missing = required.filter((key) => !process.env[key]);
const counts = {};
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (base && secret) {
  const headers = { apikey: secret, authorization: `Bearer ${secret}` };
  for (const table of ["products", "product_images", "orders"]) {
    try {
      const response = await fetch(`${base}/rest/v1/${table}?select=*&limit=1`, {
        headers: { ...headers, Prefer: "count=exact" },
        signal: AbortSignal.timeout(15000),
      });
      counts[table] = {
        status: response.status,
        count: response.headers.get("content-range")?.split("/")[1] ?? null,
      };
    } catch {
      counts[table] = { status: 0, count: null };
    }
  }
}

let web = 0;
try {
  web = (await fetch("http://127.0.0.1:3000/api/health")).status;
} catch {
  web = 0;
}

console.log(JSON.stringify({
  missing,
  counts,
  web,
  externalEffects: process.env.TUSTORE_EXTERNAL_EFFECTS_ENABLED === "true",
}, null, 2));

if (web < 200 || web >= 400 || missing.length) process.exitCode = 1;
if (Object.values(counts).some((value) => value.status >= 400)) process.exitCode = 1;
