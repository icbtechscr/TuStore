import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth:{persistSession:false}});
// ¿Ya existe alguna con slug 'redes'?
const { data: existing } = await sb.from("categories").select("id,name,slug").eq("slug","redes");
if (existing?.length) { console.log("Ya existe slug 'redes':", existing); process.exit(0); }
const id = "3fdaf06e-9741-4a7f-b700-8c6ad9237d5d"; // REDES (slug router-mikrotik)
const { data, error } = await sb.from("categories").update({ slug: "redes" }).eq("id", id).select("id,name,slug");
console.log(error ? "ERR: "+error.message : "OK → "+JSON.stringify(data));
