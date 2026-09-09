import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rewriteMediaUrl } from "@/lib/image-url";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const ids = url.searchParams.get("ids");
    const sb = createAdminClient();

    let query = sb
      .from("products")
      .select(
        "id, name, sku, price_crc, sale_price_crc, product_images ( url, position )"
      )
      // Un banner solo puede dirigir a un producto publicado públicamente.
      .eq("is_visible", true)
      .limit(20);

    if (ids) {
      query = query.in("id", ids.split(",").filter(Boolean));
    } else if (q) {
      // Comillas dobles → caracteres especiales (paréntesis, comas) literales.
      const words = q
        .split(/\s+/)
        .map((w) => w.split('"').join("").trim())
        .filter(Boolean)
        .slice(0, 6);
      for (const w of words) {
        query = query.or(`name.ilike."%${w}%",sku.ilike."%${w}%"`);
      }
    } else {
      return NextResponse.json({ products: [] });
    }

    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 500 });

    type Row = {
      id: string;
      name: string;
      sku: string | null;
      price_crc: number;
      sale_price_crc: number | null;
      product_images: { url: string; position: number }[];
    };
    const products = ((data as unknown as Row[]) ?? []).map((r) => {
      const img = [...(r.product_images ?? [])].sort(
        (a, b) => a.position - b.position
      )[0];
      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        priceCRC: r.price_crc,
        salePriceCRC: r.sale_price_crc,
        image: img?.url ? rewriteMediaUrl(img.url) : null,
      };
    });
    return NextResponse.json({ products });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
