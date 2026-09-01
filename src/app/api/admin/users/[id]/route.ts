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
    const body = (await req.json()) as { name?: string; password?: string };

    const attrs: { user_metadata?: { full_name: string }; password?: string } =
      {};
    if (typeof body.name === "string") {
      attrs.user_metadata = { full_name: body.name.trim() };
    }
    if (body.password) {
      if (body.password.length < 8) {
        return new NextResponse("Contraseña mínimo 8 caracteres", {
          status: 400,
        });
      }
      attrs.password = body.password;
    }
    if (!attrs.user_metadata && !attrs.password) {
      return new NextResponse("Nada que actualizar", { status: 400 });
    }

    const admin = createAdminClient();
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

    // No permitir auto-eliminación
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
