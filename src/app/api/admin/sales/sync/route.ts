import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";
import { syncCpiSales } from "@/lib/cpi-sales";
import { syncCpiProductSales } from "@/lib/cpi-products";
import { cpiFetchCompletadasHtml, cpiConfigured } from "@/lib/cpi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sincronizacion manual desde el admin. Solo admin/dev.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (!cpiConfigured()) {
    return new NextResponse(
      "CPI sin configurar (CPI_USER/CPI_PASS/CPI_ID en variables de entorno)",
      { status: 400 }
    );
  }
  try {
    const [sales, products] = await Promise.all([
      syncCpiSales(),
      syncCpiProductSales(),
    ]);
    return NextResponse.json({ sales, products });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

// Debug: devuelve un fragmento del HTML crudo de CPI para afinar el parser.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (new URL(req.url).searchParams.get("debug") !== "1") {
    return new NextResponse("Use ?debug=1", { status: 400 });
  }
  try {
    const html = await cpiFetchCompletadasHtml();
    return new NextResponse(html.slice(0, 20000), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
