import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function syncRange(now = new Date(), days = 3) {
  if (!Number.isInteger(days) || days < 1 || days > 62) throw new Error("Rango CPI inválido (1..62 días)");
  const to = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const from = new Date(Date.parse(`${to}T12:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

export function checkSyncTarget(env) {
  const actual = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!env.ICB_SYNC_TARGET_ORIGIN || actual.origin !== new URL(env.ICB_SYNC_TARGET_ORIGIN).origin ||
      actual.hostname.endsWith(".supabase.co")) {
    throw new Error("El worker solo puede escribir en el Supabase propio autorizado");
  }
  for (const key of ["CPI_USER", "CPI_PASS", "CPI_ID", "SUPABASE_SECRET_KEY"]) {
    if (!env[key]) throw new Error(`Falta ${key}`);
  }
}

function main() {
  checkSyncTarget(process.env);
  const days = Number(process.env.ICB_SYNC_LOOKBACK_DAYS || "3");
  const { from, to } = syncRange(new Date(), days);
  const dry = process.argv.includes("--dry-run") ? ["--dry-run"] : [];
  const jobs = ["sync-cpi.mjs", "sync-cpi-products.mjs", "sync-cpi-quotes.mjs", "sync-cpi-inventory.mjs"];
  const failures = [];
  for (const script of jobs) {
    const range = script.includes("inventory") ? [] : [`--from=${from}`, `--to=${to}`];
    console.log(`[ICB] Iniciando ${script} (${from}..${to})`);
    const result = spawnSync(process.execPath, [`scripts/${script}`, ...range, ...dry], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: process.env, stdio: "inherit", timeout: 25 * 60 * 1000,
    });
    if (result.status !== 0 || result.error) failures.push(script);
    console.log(`[ICB] ${script}: ${result.status === 0 ? "OK" : "ERROR"}`);
  }
  if (failures.length) throw new Error(`Fallaron: ${failures.join(", ")}`);
  console.log("[ICB] Sincronización completa");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
