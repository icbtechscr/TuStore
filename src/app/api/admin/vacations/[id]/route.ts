import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserFullName } from "@/lib/roles";
import { decideVacationRequest } from "@/lib/vacations-server";

// Aprobar o rechazar una solicitud de vacaciones (solo pendientes).
// La ruta vive bajo /api/admin, protegida por el proxy (solo admin/dev).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse("ID requerido", { status: 400 });

    const body = (await req.json()) as {
      status?: string;
      adminNote?: string;
    };
    if (body.status !== "aprobada" && body.status !== "rechazada") {
      return new NextResponse("Estado inválido", { status: 400 });
    }

    const admin = await getCurrentUser();
    const request = await decideVacationRequest({
      id,
      status: body.status,
      adminNote: typeof body.adminNote === "string" ? body.adminNote.trim() : "",
      decidedBy: getUserFullName(admin) || "Admin",
    });
    return NextResponse.json({ ok: true, request });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // .single() sin filas = la solicitud ya no está pendiente.
    if (msg.includes("multiple (or no) rows")) {
      return new NextResponse("La solicitud ya fue decidida o no existe", {
        status: 409,
      });
    }
    return new NextResponse(msg, { status: 500 });
  }
}
