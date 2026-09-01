import { NextResponse } from "next/server";
import { adminDeleteBrand, adminUpdateBrand } from "@/lib/admin";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse("ID requerido", { status: 400 });
    const body = (await req.json()) as { name?: string; slug?: string };
    if (
      (typeof body.name !== "string" || !body.name.trim()) &&
      typeof body.slug !== "string"
    ) {
      return new NextResponse("Nada que actualizar", { status: 400 });
    }
    const brand = await adminUpdateBrand(id, {
      name: body.name,
      slug: body.slug,
    });
    return NextResponse.json({ brand });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /duplicate|unique/i.test(msg) ? 409 : 500;
    return new NextResponse(
      status === 409 ? "Ya existe una marca con ese nombre/slug" : msg,
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
    await adminDeleteBrand(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
