// Migra las imágenes legacy (WordPress en icbtechscr.com) a Supabase Storage.
//
// Uso:
//   node --env-file=.env.local scripts/migrate-images-to-supabase.mjs --dry   (solo reporta)
//   node --env-file=.env.local scripts/migrate-images-to-supabase.mjs         (migra de verdad)
//
// Es idempotente: las URLs que ya están en Supabase se saltan. Si falla a la
// mitad, se puede re-correr sin duplicar.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const BUCKET = process.env.MEDIA_BUCKET || "media";
const DRY = process.argv.includes("--dry");

if (!SUPABASE_URL || !SECRET) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SECRET, {
  auth: { persistSession: false },
});

const LEGACY = /^https?:\/\/(www\.)?icbtechscr\.com\//i;
const isLegacy = (u) => typeof u === "string" && LEGACY.test(u);

function storagePath(u) {
  const p = new URL(u).pathname.replace(/^\/+/, "");
  // Decodifica y limpia caracteres problemáticos para la key de Storage.
  return decodeURIComponent(p).replace(/[^a-zA-Z0-9._/-]/g, "_");
}

function contentType(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  return (
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
      svg: "image/svg+xml",
    }[ext] || "application/octet-stream"
  );
}

async function ensureBucket() {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
    console.log(`Bucket "${BUCKET}" creado (público).`);
  } else {
    console.log(`Bucket "${BUCKET}" ya existe.`);
  }
}

const cache = new Map(); // url original -> url superbase (evita re-subir la misma)
let downloaded = 0;
let failed = 0;

async function migrateUrl(originalUrl) {
  if (cache.has(originalUrl)) return cache.get(originalUrl);
  const path = storagePath(originalUrl);
  const res = await fetch(originalUrl);
  if (!res.ok) {
    failed++;
    console.warn(`  ⚠ no se pudo bajar (${res.status}): ${originalUrl}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: contentType(path), upsert: true });
  if (error) {
    failed++;
    console.warn(`  ⚠ no se pudo subir: ${path} — ${error.message}`);
    return null;
  }
  const pub = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  cache.set(originalUrl, pub);
  downloaded++;
  return pub;
}

async function migrateProductImages() {
  console.log("\n== product_images ==");
  let from = 0;
  const page = 1000;
  let legacyCount = 0;
  let updated = 0;
  for (;;) {
    const { data, error } = await sb
      .from("product_images")
      .select("id, url")
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (!isLegacy(row.url)) continue;
      legacyCount++;
      if (DRY) continue;
      const pub = await migrateUrl(row.url);
      if (!pub) continue;
      const { error: e2 } = await sb
        .from("product_images")
        .update({ url: pub })
        .eq("id", row.id);
      if (e2) console.warn(`  ⚠ update fila ${row.id}: ${e2.message}`);
      else updated++;
    }
    if (data.length < page) break;
    from += page;
  }
  console.log(
    DRY
      ? `  ${legacyCount} imágenes legacy por migrar.`
      : `  ${updated} filas actualizadas (${legacyCount} legacy detectadas).`
  );
}

async function migrateSiteSettingsCategories() {
  console.log("\n== site_settings (categorías) ==");
  const { data, error } = await sb
    .from("site_settings")
    .select("key, value")
    .eq("key", "categories")
    .maybeSingle();
  if (error || !data?.value) {
    console.log("  sin categorías personalizadas.");
    return;
  }
  const value = data.value;
  const items = Array.isArray(value.items) ? value.items : [];
  let changed = false;
  let count = 0;
  for (const it of items) {
    if (!isLegacy(it.imageUrl)) continue;
    count++;
    if (DRY) continue;
    const pub = await migrateUrl(it.imageUrl);
    if (pub) {
      it.imageUrl = pub;
      changed = true;
    }
  }
  if (changed && !DRY) {
    const { error: e2 } = await sb
      .from("site_settings")
      .update({ value })
      .eq("key", "categories");
    if (e2) console.warn(`  ⚠ update categorías: ${e2.message}`);
  }
  console.log(
    DRY ? `  ${count} imágenes de categoría por migrar.` : `  ${count} procesadas.`
  );
}

async function main() {
  console.log(DRY ? "MODO DRY-RUN (no escribe nada)\n" : "MIGRANDO…\n");
  if (!DRY) await ensureBucket();
  await migrateProductImages();
  await migrateSiteSettingsCategories();
  console.log(
    `\nListo. Subidas: ${downloaded} · Fallidas: ${failed}` +
      (DRY ? " (dry-run)" : "")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
