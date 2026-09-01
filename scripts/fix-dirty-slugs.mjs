import { createClient } from "@supabase/supabase-js";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

function slugify(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const { data, error } = await admin.from("products").select("id,name,slug");
if (error) throw error;

const dirty = data.filter((p) => p.slug !== slugify(p.slug));
const taken = new Set(
  data.filter((p) => !dirty.includes(p)).map((p) => p.slug)
);

console.log(`Arreglando ${dirty.length} slugs sucios…\n`);
for (const p of dirty) {
  let base = slugify(p.slug) || slugify(p.name) || p.id;
  let candidate = base;
  let i = 2;
  while (taken.has(candidate)) candidate = `${base}-${i++}`;
  taken.add(candidate);
  const { error: e } = await admin
    .from("products")
    .update({ slug: candidate })
    .eq("id", p.id);
  if (e) {
    console.log("  ✗", p.id, e.message);
  } else {
    console.log("  ✓", JSON.stringify(p.slug), "→", candidate);
  }
}
console.log("\nListo.");
