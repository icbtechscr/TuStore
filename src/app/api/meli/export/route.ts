import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, canSell } from "@/lib/roles";
import { getProductsByIds } from "@/lib/products";

export const dynamic = "force-dynamic";

function stripHtml(s: string): string {
  return (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Excel en español suele usar ';' como separador; agregamos BOM para los acentos.
function cell(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canSell(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  let ids: string[] = [];
  try {
    const body = (await req.json()) as { ids?: unknown };
    ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    ids = [];
  }
  if (ids.length === 0) {
    return new NextResponse("Sin productos seleccionados", { status: 400 });
  }

  const products = await getProductsByIds(ids);

  const headers = [
    "Titulo",
    "Precio (CRC)",
    "Moneda",
    "Stock",
    "Condicion",
    "Categoria",
    "Marca",
    "SKU",
    "Fotos (URLs)",
    "Descripcion",
  ];
  const lines = [headers.join(";")];
  for (const p of products) {
    const price = p.salePriceCRC ?? p.priceCRC;
    const stock = p.stockQty ?? (p.inStock ? 1 : 0);
    const fotos = p.images.map((i) => i.src).join(" | ");
    const cat = p.categories[0]?.name ?? "";
    const desc = stripHtml(p.description || p.shortDescription || "");
    lines.push(
      [
        cell(p.name),
        cell(price),
        cell("CRC"),
        cell(stock),
        cell("Nuevo"),
        cell(cat),
        cell(p.brand ?? ""),
        cell(p.sku ?? ""),
        cell(fotos),
        cell(desc),
      ].join(";")
    );
  }
  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="productos-mercadolibre.csv"',
    },
  });
}
