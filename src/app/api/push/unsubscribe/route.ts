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

    const body = (await req.json()) as { endpoint?: string };
    if (!body.endpoint) return new NextResponse("Falta endpoint", { status: 400 });

    const admin = createAdminClient();
    await admin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", body.endpoint)
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
