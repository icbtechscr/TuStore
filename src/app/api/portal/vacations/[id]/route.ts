import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { cancelMyVacationRequest } from "@/lib/vacations-server";

// Cancelar una solicitud propia que sigue pendiente.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse("ID requerido", { status: 400 });

    const sb = await createSupabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return new NextResponse("No autenticado", { status: 401 });

    const done = await cancelMyVacationRequest(id, user.id);
    if (!done) {
      return new NextResponse(
        "La solicitud ya fue decidida o no existe",
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
