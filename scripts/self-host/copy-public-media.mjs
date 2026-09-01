import { createHash } from "node:crypto";
const source = new URL(process.argv[2]);
const target = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const prefix = "/storage/v1/object/public/";
if (source.origin !== "https://fnnzlkvohsaxwnmdymvc.supabase.co" || !source.pathname.startsWith(prefix) ||
    target.hostname.endsWith(".supabase.co") || source.search || source.username || source.password) {
  throw new Error("Only a known public source and a self-hosted destination are allowed");
}
const destination = target.origin + source.pathname;
const existing = await fetch(destination, { method: "HEAD", signal: AbortSignal.timeout(15000) });
if (existing.ok) throw new Error("Destination already exists; this tool never overwrites files");
const response = await fetch(source, { signal: AbortSignal.timeout(30000), redirect: "error" });
if (!response.ok) throw new Error(`Source: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const upload = await fetch(target.origin + source.pathname.replace(prefix, "/storage/v1/object/"), {
  method: "POST", headers: {
    apikey: process.env.SUPABASE_SECRET_KEY,
    authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
    "content-type": response.headers.get("content-type") || "application/octet-stream",
    "x-upsert": "false",
  }, body: bytes, signal: AbortSignal.timeout(30000),
});
if (!upload.ok) throw new Error(`Upload: HTTP ${upload.status}`);
const check = await fetch(destination, { signal: AbortSignal.timeout(15000) });
const restored = Buffer.from(await check.arrayBuffer());
const hash = value => createHash("sha256").update(value).digest("hex");
if (!check.ok || hash(bytes) !== hash(restored)) throw new Error("Copied image verification failed");
console.log(JSON.stringify({ copied: true, bytes: bytes.length, verified: true }));
