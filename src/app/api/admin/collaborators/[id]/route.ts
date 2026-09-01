import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse("ID requerido", { status: 400 });
    const body = (await req.json()) as {
      name?: string;
      password?: string;
      role?: string;
      branchIds?: string[];
      cedula?: string;
      hireDate?: string | null;
      vacationRate?: number;
      vacationAdjust?: number;
      entryTime?: string;
    };

    const admin = createAdminClient();

    // Traer metadata actual para hacer merge (no perder otras llaves).
    const { data: existing, error: getErr } =
      await admin.auth.admin.getUserById(id);
    if (getErr) return new NextResponse(getErr.message, { status: 400 });
    const meta = { ...(existing.user?.user_metadata ?? {}) } as Record<
      string,
      unknown
    >;

    if (typeof body.name === "string") meta.full_name = body.name.trim();
    if (
      body.role === "admin" ||
      body.role === "colaborador" ||
      body.role === "dev"
    ) {
      meta.role = body.role;
    }
    if (Array.isArray(body.branchIds)) {
      meta.branch_ids = body.branchIds.filter((x) => typeof x === "string");
      delete meta.branch_id; // limpiar el campo legacy
    }
    if (typeof body.cedula === "string") meta.cedula = body.cedula.trim();
    if (body.hireDate === null) meta.hire_date = null;
    else if (
      typeof body.hireDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.hireDate)
    ) {
      meta.hire_date = body.hireDate;
    }
    if (Number.isFinite(body.vacationRate) && Number(body.vacationRate) >= 0) {
      meta.vacation_rate = Number(body.vacationRate);
    }
    if (Number.isFinite(body.vacationAdjust)) {
      meta.vacation_adjust = Number(body.vacationAdjust);
    }
    if (typeof body.entryTime === "string" && /^\d{2}:\d{2}$/.test(body.entryTime)) {
      meta.entry_time = body.entryTime;
    }

    const attrs: {
      user_metadata: Record<string, unknown>;
      password?: string;
    } = { user_metadata: meta };

    if (body.password) {
      if (body.password.length < 8) {
        return new NextResponse("Contraseña mínimo 8 caracteres", {
          status: 400,
        });
      }
      attrs.password = body.password;
    }

    const { error } = await admin.auth.admin.updateUserById(id, attrs);
    if (error) return new NextResponse(error.message, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

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
    if (user && user.id === id) {
      return new NextResponse("No podés eliminar tu propio usuario", {
        status: 400,
      });
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return new NextResponse(error.message, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
