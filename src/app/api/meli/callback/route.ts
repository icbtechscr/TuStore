import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { exchangeCode, meliMe, saveConnection } from "@/lib/meli";

export const dynamic = "force-dynamic";

// MercadoLibre redirige aquí tras autorizar. Cambia el code por tokens y guarda
// la conexión del vendedor.
export async function GET(req: Request) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const back = new URL("/portal/mercadolibre", site);
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.redirect(new URL("/ingresar", site));

    const url = new URL(req.url);
    const err = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (err) {
      back.searchParams.set("error", err);
      return NextResponse.redirect(back);
    }
    if (!code) {
      back.searchParams.set("error", "Autorización sin código.");
      return NextResponse.redirect(back);
    }
    if (state && state !== user.id) {
      back.searchParams.set("error", "Estado inválido (state).");
      return NextResponse.redirect(back);
    }

    const tokens = await exchangeCode(code);
    const me = await meliMe(tokens.access_token);
    await saveConnection(user.id, tokens, me.nickname);

    back.searchParams.set("ok", "1");
    return NextResponse.redirect(back);
  } catch (e) {
    back.searchParams.set(
      "error",
      e instanceof Error ? e.message : "Error al conectar con MercadoLibre."
    );
    return NextResponse.redirect(back);
  }
}
