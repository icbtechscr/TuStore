import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserFullName } from "@/lib/roles";
import { computeBalance, getEmployeeHrProfile } from "@/lib/vacations";
import {
  createVacationRequest,
  listMyVacationRequests,
} from "@/lib/vacations-server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Crear una solicitud de vacaciones (el colaborador, por sí mismo).
export async function POST(req: Request) {
  try {
    const sb = await createSupabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return new NextResponse("No autenticado", { status: 401 });

    const body = (await req.json()) as {
      startDate?: string;
      endDate?: string;
      days?: number;
      note?: string;
    };
    const startDate = body.startDate ?? "";
    const endDate = body.endDate ?? "";
    const days = Number(body.days);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return new NextResponse("Fechas inválidas", { status: 400 });
    }
    if (endDate < startDate) {
      return new NextResponse(
        "La fecha final no puede ser antes de la inicial",
        { status: 400 }
      );
    }
    if (!Number.isFinite(days) || days <= 0 || days > 60) {
      return new NextResponse("Cantidad de días inválida", { status: 400 });
    }

    // No permitir pedir más días de los disponibles (contando pendientes).
    const requests = await listMyVacationRequests(user.id, 200);
    const balance = computeBalance(getEmployeeHrProfile(user), requests);
    if (balance.hasHireDate) {
      const remaining = balance.available - balance.pending;
      if (days > remaining + 0.001) {
        return new NextResponse(
          `Solo tenés ${Math.max(0, Math.round(remaining * 100) / 100)} días disponibles (contando solicitudes pendientes).`,
          { status: 400 }
        );
      }
    }

    const request = await createVacationRequest({
      userId: user.id,
      employeeName: getUserFullName(user),
      startDate,
      endDate,
      days,
      note,
    });
    return NextResponse.json({ ok: true, request });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
