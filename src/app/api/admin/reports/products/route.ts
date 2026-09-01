import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";
import { getAllTimeProductRanking } from "@/lib/cpi-products";

export const dynamic = "force-dynamic";

function cell(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Reporte CSV (abre en Excel) del ranking historico de productos.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const rows = await getAllTimeProductRanking();
  const headers = [
    "#",
    "SKU",
    "Producto",
    "Unidades",
    "Monto CRC",
    "Monto USD",
    "Dias con venta",
    "Ultima venta",
  ];
  const lines = [headers.join(";")];
  for (const p of rows) {
    lines.push(
      [
        cell(p.rank),
        cell(p.sku),
        cell(p.descripcion),
        cell(p.cantidad),
        cell(Math.round(p.crc)),
        cell(p.usd ? Math.round(p.usd * 100) / 100 : 0),
        cell(p.saleDays),
        cell(p.lastSale ?? ""),
      ].join(";")
    );
  }
  const csv = "\uFEFF" + lines.join("\r\n");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
  }).format(new Date());

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="TUStore-productos-mas-vendidos-${today}.csv"`,
      "cache-control": "private, no-store, max-age=0",
    },
  });
}
