import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase";
import { isPunchType } from "@/lib/timeclock";

export const dynamic = "force-dynamic";

// Crear una marca manual (solo rol "dev"). Útil cuando alguien olvidó marcar.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("No autenticado", { status: 401 });
  if (getUserRole(user) !== "dev") {
    return new NextResponse("Solo el rol Dev puede crear marcas", { status: 403 });
  }

  const body = (await req.json()) as {
    userId?: string;
    employeeName?: string;
    branchName?: string | null;
    branchId?: string | null;
    punchType?: string;
    punchedAt?: string;
  };

  if (!body.userId) return new NextResponse("Falta userId", { status: 400 });
  if (!isPunchType(body.punchType)) {
    return new NextResponse("Tipo de marcaje inválido", { status: 400 });
  }
  if (!body.punchedAt || Number.isNaN(Date.parse(body.punchedAt))) {
    return new NextResponse("Fecha/hora inválida", { status: 400 });
  }

  const sb = createAdminClient();
  const { error } = await sb.from("time_entries").insert({
    user_id: body.userId,
    employee_name: body.employeeName ?? "",
    branch_id: body.branchId ?? null,
    branch_name: body.branchName ?? null,
    punch_type: body.punchType,
    punched_at: new Date(body.punchedAt).toISOString(),
    // Marca manual: sin GPS.
    latitude: null,
    longitude: null,
    accuracy_m: null,
    distance_m: null,
    within_range: null,
  });
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
