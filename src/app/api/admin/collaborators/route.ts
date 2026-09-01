import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import {
  getUserRole,
  getUserBranchIds,
  mustClockIn,
  type UserRole,
} from "@/lib/roles";
import { getEmployeeHrProfile } from "@/lib/vacations";

export type CollaboratorDTO = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branchIds: string[];
  createdAt: string;
  lastSignInAt: string | null;
  cedula: string;
  hireDate: string | null;
  vacationRate: number;
  vacationAdjust: number;
  entryTime: string;
};

function normalizeRole(raw?: string): UserRole {
  if (raw === "admin") return "admin";
  if (raw === "dev") return "dev";
  return "colaborador";
}

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });
    if (error) return new NextResponse(error.message, { status: 500 });
    const users: CollaboratorDTO[] = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.full_name as string) ?? "",
      role: getUserRole(u),
      branchIds: getUserBranchIds(u),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      ...getEmployeeHrProfile(u),
    }));
    return NextResponse.json({ users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      branchIds?: string[];
      cedula?: string;
      hireDate?: string;
      vacationRate?: number;
      vacationAdjust?: number;
      entryTime?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const name = body.name?.trim() ?? "";
    const role = normalizeRole(body.role);
    const branchIds = Array.isArray(body.branchIds)
      ? body.branchIds.filter((x) => typeof x === "string")
      : [];
    const cedula = typeof body.cedula === "string" ? body.cedula.trim() : "";
    const hireDate =
      typeof body.hireDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.hireDate)
        ? body.hireDate
        : null;
    const vacationRate =
      Number.isFinite(body.vacationRate) && Number(body.vacationRate) >= 0
        ? Number(body.vacationRate)
        : 1;
    const vacationAdjust = Number.isFinite(body.vacationAdjust)
      ? Number(body.vacationAdjust)
      : 0;
    const entryTime =
      typeof body.entryTime === "string" && /^\d{2}:\d{2}$/.test(body.entryTime)
        ? body.entryTime
        : "08:30";

    if (!email || !email.includes("@")) {
      return new NextResponse("Correo inválido", { status: 400 });
    }
    if (password.length < 8) {
      return new NextResponse("Contraseña mínimo 8 caracteres", { status: 400 });
    }
    // Quien marca (colaborador o dev) necesita al menos una sede.
    if (mustClockIn(role) && branchIds.length === 0) {
      return new NextResponse("Asigná al menos una sede", { status: 400 });
    }

    const sb = createAdminClient();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role,
        branch_ids: branchIds,
        cedula,
        hire_date: hireDate,
        vacation_rate: vacationRate,
        vacation_adjust: vacationAdjust,
        entry_time: entryTime,
      },
    });
    if (error) return new NextResponse(error.message, { status: 400 });
    return NextResponse.json({
      ok: true,
      user: { id: data.user.id, email: data.user.email ?? "" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
