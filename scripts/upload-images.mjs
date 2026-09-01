// Upload scraped images to Supabase Storage bucket, then update product_images.url
// Usage: node scripts/upload-images.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "imagenes";

const sb = createClient(url, key, { auth: { persistSession: false } });

const IMG_DIR = path.resolve("../scrape/images");
const files = readdirSync(IMG_DIR);
console.log(`Found ${files.length} images in ${IMG_DIR}`);

const mimeMap = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

let ok = 0, fail = 0, skip = 0;
const urlMap = new Map(); // localFileName -> publicUrl

for (let i = 0; i < files.length; i++) {
  const fname = files[i];
  const ext = path.extname(fname).toLowerCase();
  const mime = mimeMap[ext] || "application/octet-stream";
  const body = readFileSync(path.join(IMG_DIR, fname));
  const key = `products/${fname}`;

  const { error } = await sb.storage.from(bucket).upload(key, body, {
    contentType: mime,
    upsert: true,
  });

  if (error) {
    console.error(`  ✗ ${fname}: ${error.message}`);
    fail++;
  } else {
    const { data } = sb.storage.from(bucket).getPublicUrl(key);
    urlMap.set(fname, data.publicUrl);
    ok++;
  }

  if ((i + 1) % 50 === 0) console.log(`  [${i + 1}/${files.length}] ok=${ok} fail=${fail}`);
}

console.log(`\nUpload done: ok=${ok} fail=${fail}`);
console.log("\nUpdating product_images.url ...");

// Map original Woo URL -> new Supabase URL
// Filename pattern: <SKU sanitized>_<idx>.<ext>
// We rebuild by querying product_images joined with products.sku
const { data: imgs, error: e1 } = await sb
  .from("product_images")
  .select("id, url, position, product:products(sku)");
if (e1) { console.error(e1); process.exit(1); }

const sanitize = (s) => (s || "").replace(/[^a-zA-Z0-9_-]/g, "_");

const updates = [];
for (const r of imgs) {
  const sku = r.product?.sku;
  if (!sku) continue;
  // Try several extensions
  for (const ext of [".jpg", ".png", ".webp", ".jpeg", ".gif"]) {
    const fname = `${sanitize(sku)}_${r.position}${ext}`;
    if (urlMap.has(fname)) {
      updates.push({ id: r.id, url: urlMap.get(fname) });
      break;
    }
  }
}

console.log(`Updating ${updates.length} image rows...`);
for (let i = 0; i < updates.length; i += 200) {
  const chunk = updates.slice(i, i + 200);
  for (const u of chunk) {
    await sb.from("product_images").update({ url: u.url }).eq("id", u.id);
  }
  console.log(`  ${Math.min(i + 200, updates.length)}/${updates.length}`);
}

console.log("\n✅ Storage upload + URL rewrite complete!");
