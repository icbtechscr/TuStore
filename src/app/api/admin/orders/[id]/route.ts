import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return new NextResponse("ID requerido", { status: 400 });
    const body = (await req.json()) as {
      status?: string;
      paymentStatus?: string;
    };

    const patch: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (body.status) {
      if (!ORDER_STATUSES.includes(body.status as OrderStatus)) {
        return new NextResponse("Estado inválido", { status: 400 });
      }
      patch.status = body.status;
    }
    if (body.paymentStatus) {
      patch.payment_status = body.paymentStatus;
    }
    if (Object.keys(patch).length === 1) {
      return new NextResponse("Nada que actualizar", { status: 400 });
    }

    const sb = createAdminClient();
    const { error } = await sb.from("orders").update(patch).eq("id", id);
    if (error) return new NextResponse(error.message, { status: 500 });
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
    const sb = createAdminClient();
    // order_items se borra en cascada (on delete cascade).
    const { error } = await sb.from("orders").delete().eq("id", id);
    if (error) return new NextResponse(error.message, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
