import { NextResponse } from "next/server";
import { adminCreateCategory, adminListCategories } from "@/lib/admin";

export async function GET() {
  try {
    const categories = await adminListCategories();
    return NextResponse.json({ categories });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      slug?: string;
      parentId?: string | null;
    };
    const name = body.name?.trim();
    if (!name) return new NextResponse("El nombre es requerido", { status: 400 });
    const category = await adminCreateCategory({
      name,
      slug: body.slug ?? null,
      parentId: body.parentId ?? null,
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
