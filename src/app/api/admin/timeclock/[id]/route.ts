import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Solo el rol "dev" puede editar/borrar marcas.
async function requireDev() {
  const user = await getCurrentUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  if (getUserRole(user) !== "dev") {
    return { error: "Solo el rol Dev puede editar marcas", status: 403 as const };
  }
  return { user };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireDev();
  if ("error" in auth) {
    return new NextResponse(auth.error, { status: auth.status });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as { punchedAt?: string };
  if (!body.punchedAt || Number.isNaN(Date.parse(body.punchedAt))) {
    return new NextResponse("Fecha/hora inválida", { status: 400 });
  }
  const sb = createAdminClient();
  const { error } = await sb
    .from("time_entries")
    .update({ punched_at: new Date(body.punchedAt).toISOString() })
    .eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireDev();
  if ("error" in auth) {
    return new NextResponse(auth.error, { status: auth.status });
  }
  const { id } = await ctx.params;
  const sb = createAdminClient();
  const { error } = await sb.from("time_entries").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
