import { NextResponse } from "next/server";
import { adminCreateProduct, type ProductWritePayload } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProductWritePayload;
    if (!body.name || !body.slug) {
      return new NextResponse("name y slug son requeridos", { status: 400 });
    }
    const id = await adminCreateProduct(body);
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
