// Temporary QA identity in self-hosted Supabase only. Never sends an email.
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (base.hostname.endsWith(".supabase.co")) throw new Error("QA is restricted to self-hosted Supabase");
const file = "/tmp/icb-qa-account.json";
const headers = { apikey: process.env.SUPABASE_SECRET_KEY, authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`, "content-type": "application/json" };
if (process.argv[2] === "create") {
  if (existsSync(file)) throw new Error("Clean up the existing QA identity first");
  const email = `migration-qa-${randomBytes(6).toString("hex")}@example.invalid`;
  const password = randomBytes(32).toString("base64url");
  const response = await fetch(`${base.origin}/auth/v1/admin/users`, { method: "POST", headers, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role: "dev", full_name: "QA temporal migración", migration_qa: true } }) });
  if (!response.ok) throw new Error(`QA create: HTTP ${response.status}`);
  const user = await response.json();
  writeFileSync(file, JSON.stringify({ id: user.id, email, password }), { mode: 0o600, flag: "wx" });
  console.log("QA account created (credentials not printed)");
} else if (process.argv[2] === "delete") {
  const qa = JSON.parse(readFileSync(file, "utf8"));
  const check = await fetch(`${base.origin}/auth/v1/admin/users/${encodeURIComponent(qa.id)}`, { headers });
  const user = await check.json();
  if (!check.ok || user.id !== qa.id || user.email !== qa.email || user.user_metadata?.migration_qa !== true || !user.email.startsWith("migration-qa-")) throw new Error("Refusing to delete non-QA identity");
  const response = await fetch(`${base.origin}/auth/v1/admin/users/${encodeURIComponent(qa.id)}`, { method: "DELETE", headers });
  if (!response.ok) throw new Error(`QA cleanup: HTTP ${response.status}`);
  unlinkSync(file);
  console.log("Temporary QA account removed");
} else throw new Error("Use create or delete");
