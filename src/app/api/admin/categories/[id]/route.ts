import { NextResponse } from "next/server";
import { adminDeleteCategory, adminUpdateCategory } from "@/lib/admin";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse("ID requerido", { status: 400 });
    const body = (await req.json()) as {
      name?: string;
      parentId?: string | null;
    };
    if (
      (typeof body.name !== "string" || !body.name.trim()) &&
      body.parentId === undefined
    ) {
      return new NextResponse("Nada que actualizar", { status: 400 });
    }
    const category = await adminUpdateCategory(id, {
      name: body.name,
      parentId: body.parentId,
    });
    return NextResponse.json({ category });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /duplicate|unique/i.test(msg) ? 409 : 500;
    return new NextResponse(
      status === 409 ? "Ya existe una categoría con ese nombre/slug" : msg,
      { status }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse("ID requerido", { status: 400 });
    await adminDeleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
