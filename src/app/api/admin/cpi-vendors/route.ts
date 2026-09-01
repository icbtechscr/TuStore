import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase-server";
import { getUserRole, getUserFullName, isAdminLike } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase";
import { listVendorsWithStats, setVendorUser, setVendorIgnored } from "@/lib/cpi-sales";

export const dynamic = "force-dynamic";

export type PortalUserDTO = { id: string; name: string; email: string };

async function guard() {
  const user = await getCurrentUser();
  if (!user || !isAdminLike(getUserRole(user))) return null;
  return user;
}

export async function GET() {
  if (!(await guard())) return new NextResponse("No autorizado", { status: 401 });
  try {
    const sb = createAdminClient();
    const [{ data }, vendors] = await Promise.all([
      sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      listVendorsWithStats(),
    ]);
    const users: PortalUserDTO[] = (data?.users ?? []).map((u) => ({
      id: u.id,
      name: getUserFullName(u),
      email: u.email ?? "",
    }));
    users.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ vendors, users });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await guard())) return new NextResponse("No autorizado", { status: 401 });
  try {
    const body = (await req.json()) as {
      cpi_vendor?: string;
      user_id?: string | null;
      ignored?: boolean;
    };
    if (!body.cpi_vendor) return new NextResponse("Falta cpi_vendor", { status: 400 });
    if (typeof body.ignored === "boolean") {
      await setVendorIgnored(body.cpi_vendor, body.ignored);
    } else {
      await setVendorUser(body.cpi_vendor, body.user_id || null);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 500 });
  }
}
