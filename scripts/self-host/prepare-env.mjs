// Exporta UNICAMENTE variables necesarias; nunca imprime sus valores.
// Uso: node scripts/self-host/prepare-env.mjs <archivo-json-privado-nuevo>
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createECDH, randomBytes } from "node:crypto";
import { resolve } from "node:path";

const output = process.argv[2];
if (!output) throw new Error("Indique un archivo de salida privado fuera del repositorio");
const keys = [
  "CPI_BASE_URL", "CPI_ID", "CPI_USER", "CPI_PASS", "CPI_ACTIVITY_CODES", "CPI_TAX_TYPES",
  "CPI_INVENTORY_BRANCHES", "TUSTORE_SYNC_TARGET_ORIGIN", "TUSTORE_SYNC_LOOKBACK_DAYS",
  "TUSTORE_CPI_ENABLED",
  "CYBS_MERCHANT_ID", "CYBS_KEY_ID", "CYBS_SECRET_KEY", "CYBS_RUN_ENV",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT",
  "RESEND_API_KEY", "ORDER_MAIL_FROM", "ORDER_NOTIFY_EMAIL", "CRON_SECRET",
  "GEMINI_API_KEY", "GEMINI_MODEL", "AGENT_WORKER_SECRET", "SEASON_OVERRIDE",
];
const env = {};
const origins = {};
for (const filename of [".env.vercel", ".env.newvercel", ".env.local"]) {
  let input;
  try { input = parseEnv(readFileSync(resolve(filename), "utf8")); }
  catch (error) { if (error.code === "ENOENT") continue; throw error; }
  for (const key of keys) {
    const value = input[key]?.trim();
    if (!value || /^(xxx+|your[_-]|replace[_-]|changeme)/i.test(value)) continue;
    if (/[\r\n\0]/.test(value)) throw new Error(`Valor multilinea no admitido: ${key}`);
    env[key] = value;
    origins[key] = filename;
  }
}
env.CPI_BASE_URL ||= "https://www.appcontadorcpi.com/gm/";
env.CRON_SECRET ||= randomBytes(32).toString("hex");
env.TUSTORE_EXTERNAL_EFFECTS_ENABLED = "false";
if (env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY) {
  const pair = createECDH("prime256v1");
  pair.setPrivateKey(Buffer.from(env.VAPID_PRIVATE_KEY, "base64url"));
  if (pair.getPublicKey().toString("base64url") !== env.VAPID_PUBLIC_KEY ||
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== env.VAPID_PUBLIC_KEY) {
    throw new Error("Las claves VAPID recuperadas no corresponden entre sí");
  }
}
writeFileSync(output, JSON.stringify(env), { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ exported: Object.keys(env), missing: keys.filter(k => !env[k]), origins }, null, 2));
