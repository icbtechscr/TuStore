import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) return new NextResponse(error.message, { status: 500 });
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.full_name as string) ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
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
    };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const name = body.name?.trim() ?? "";
    if (!email || !email.includes("@")) {
      return new NextResponse("Correo inválido", { status: 400 });
    }
    if (password.length < 8) {
      return new NextResponse("Contraseña mínimo 8 caracteres", {
        status: 400,
      });
    }
    const sb = createAdminClient();
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
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
