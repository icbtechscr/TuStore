import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { meliAuthUrl, meliConfigured } from "@/lib/meli";

export const dynamic = "force-dynamic";

// Inicia el OAuth: manda al vendedor a autorizar en MercadoLibre.
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/ingresar", site));
  if (!meliConfigured()) {
    const back = new URL("/portal/mercadolibre", site);
    back.searchParams.set(
      "error",
      "MercadoLibre no está configurado (faltan MELI_APP_ID / MELI_SECRET)."
    );
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(meliAuthUrl(user.id));
}
