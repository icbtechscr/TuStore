import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const sb = await createSupabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return new NextResponse("No autenticado", { status: 401 });

    const body = (await req.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      userAgent?: string;
    };
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return new NextResponse("Suscripción inválida", { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        user_agent: body.userAgent ?? null,
      },
      { onConflict: "endpoint" }
    );
    if (error) return new NextResponse(error.message, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
