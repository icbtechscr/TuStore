import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, isAdminLike } from "@/lib/roles";

export const dynamic = "force-dynamic";

// Diagnostico de correo: dice que variables faltan y manda un correo de prueba,
// devolviendo la respuesta cruda de Resend para ver el error exacto.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const key = process.env.RESEND_API_KEY ?? "";
  const from = process.env.ORDER_MAIL_FROM ?? "";
  const to = process.env.ORDER_NOTIFY_EMAIL ?? "";

  const config = {
    RESEND_API_KEY: key ? `presente (${key.slice(0, 6)}…, ${key.length} chars)` : "FALTA",
    ORDER_MAIL_FROM: from || "FALTA",
    ORDER_NOTIFY_EMAIL: to || "FALTA",
  };

  if (!key || !to) {
    return NextResponse.json(
      { ok: false, motivo: "Faltan variables de entorno en Vercel", config },
      { status: 400 }
    );
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: from || "TUStore <onboarding@resend.dev>",
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        subject: "Prueba de correo — TUStore",
        html: "<p>Si ves esto, los avisos de pedidos ya funcionan.</p>",
      }),
    });
    const text = await res.text();
    return NextResponse.json(
      { ok: res.ok, status: res.status, respuestaResend: text, config },
      { status: res.ok ? 200 : 502 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), config },
      { status: 500 }
    );
  }
}
