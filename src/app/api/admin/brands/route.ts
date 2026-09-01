import { NextResponse } from "next/server";
import { adminCreateBrand, adminListBrands } from "@/lib/admin";

export async function GET() {
  try {
    const brands = await adminListBrands();
    return NextResponse.json({ brands });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; slug?: string };
    const name = body.name?.trim();
    if (!name) return new NextResponse("El nombre es requerido", { status: 400 });
    const brand = await adminCreateBrand({ name, slug: body.slug ?? null });
    return NextResponse.json({ brand });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Slug duplicado u otra restricción única.
    const status = /duplicate|unique/i.test(msg) ? 409 : 500;
    return new NextResponse(
      status === 409 ? "Ya existe una marca con ese nombre/slug" : msg,
      { status }
    );
  }
}
