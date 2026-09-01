// Import scraped Woo data into Supabase
// Usage: node scripts/import-data.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing env vars. Check .env.local");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const decodeHtml = (s) =>
  (s ?? "")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
const stripHtml = (s) => decodeHtml(s).replace(/<[^>]+>/g, "").trim();

const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));

const products = readJson("./data/products.json");
const categories = readJson("./data/categories.json");

console.log(`Loaded: ${products.length} products, ${categories.length} categories`);

// 1) Categories — keep all 200, woo slugs are unique
const catRows = categories.map((c) => ({
  woo_id: c.id,
  name: decodeHtml(c.name).trim(),
  slug: c.slug,
}));

console.log("Inserting categories...");
const catIdByWooId = new Map();
for (let i = 0; i < catRows.length; i += 100) {
  const chunk = catRows.slice(i, i + 100);
  const { data, error } = await sb
    .from("categories")
    .upsert(chunk, { onConflict: "slug" })
    .select("id, woo_id");
  if (error) {
    console.error("Categories error:", error);
    process.exit(1);
  }
  for (const r of data) catIdByWooId.set(r.woo_id, r.id);
}
console.log(`Categories OK: ${catIdByWooId.size}`);

// 2) Brands — dedupe from products
const brandSet = new Set();
for (const p of products) for (const b of p.brands ?? []) brandSet.add(decodeHtml(b.name).trim());
const brandRows = [...brandSet].map((name) => ({
  name,
  slug: name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, ""),
}));

console.log(`Inserting ${brandRows.length} brands...`);
const { data: brandData, error: brandErr } = await sb
  .from("brands")
  .upsert(brandRows, { onConflict: "slug" })
  .select("id, name");
if (brandErr) {
  console.error("Brands error:", brandErr);
  process.exit(1);
}
const brandIdByName = new Map(brandData.map((b) => [b.name, b.id]));
console.log(`Brands OK: ${brandData.length}`);

// 3) Products
const prodRows = products.map((p) => {
  const brandName = p.brands?.[0]?.name ? decodeHtml(p.brands[0].name).trim() : null;
  return {
    woo_id: p.id,
    sku: p.sku || null,
    slug: p.slug,
    name: decodeHtml(p.name),
    short_description: stripHtml(p.short_description),
    description: stripHtml(p.description),
    price_crc: parseInt(p.prices?.price ?? "0", 10) || 0,
    sale_price_crc: p.on_sale ? parseInt(p.prices?.sale_price ?? "0", 10) || null : null,
    on_sale: !!p.on_sale,
    in_stock: !!p.is_in_stock,
    stock_status: p.is_in_stock ? "in_stock" : "out_of_stock",
    stock_qty:
      typeof p.low_stock_remaining === "number" && Number.isFinite(p.low_stock_remaining)
        ? p.low_stock_remaining
        : null,
    brand_id: brandName ? brandIdByName.get(brandName) ?? null : null,
    weight: p.weight ? parseFloat(p.weight) || null : null,
    attributes: {},
  };
});

console.log("Inserting products...");
const prodIdByWooId = new Map();
for (let i = 0; i < prodRows.length; i += 100) {
  const chunk = prodRows.slice(i, i + 100);
  const { data, error } = await sb
    .from("products")
    .upsert(chunk, { onConflict: "slug" })
    .select("id, woo_id");
  if (error) {
    console.error("Products error:", error);
    process.exit(1);
  }
  for (const r of data) prodIdByWooId.set(r.woo_id, r.id);
  console.log(`  ${prodIdByWooId.size}/${prodRows.length}`);
}
console.log(`Products OK: ${prodIdByWooId.size}`);

// 4) product_categories
const pcRows = [];
for (const p of products) {
  const pid = prodIdByWooId.get(p.id);
  if (!pid) continue;
  const seen = new Set();
  for (const c of p.categories ?? []) {
    const cid = catIdByWooId.get(c.id);
    if (cid && !seen.has(cid)) {
      pcRows.push({ product_id: pid, category_id: cid });
      seen.add(cid);
    }
  }
}
console.log(`Inserting ${pcRows.length} product-category links...`);
for (let i = 0; i < pcRows.length; i += 500) {
  const chunk = pcRows.slice(i, i + 500);
  const { error } = await sb
    .from("product_categories")
    .upsert(chunk, { onConflict: "product_id,category_id" });
  if (error) {
    console.error("PC error:", error);
    process.exit(1);
  }
}
console.log("PC OK");

// 5) Images — clear+insert for clean re-runs
console.log("Clearing old product_images...");
await sb.from("product_images").delete().neq("id", "00000000-0000-0000-0000-000000000000");

const imgRows = [];
for (const p of products) {
  const pid = prodIdByWooId.get(p.id);
  if (!pid) continue;
  let idx = 0;
  for (const img of p.images ?? []) {
    imgRows.push({
      product_id: pid,
      url: img.src,
      alt: decodeHtml(img.alt) ?? "",
      position: idx++,
    });
  }
}
console.log(`Inserting ${imgRows.length} images...`);
for (let i = 0; i < imgRows.length; i += 500) {
  const { error } = await sb.from("product_images").insert(imgRows.slice(i, i + 500));
  if (error) {
    console.error("Images error:", error);
    process.exit(1);
  }
}
console.log("Images OK");

console.log("\n✅ Import complete!");
console.log({
  categories: catIdByWooId.size,
  brands: brandData.length,
  products: prodIdByWooId.size,
  product_categories: pcRows.length,
  images: imgRows.length,
});
