import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createSession, getSdkAssets, decodeJwtPayload } from "@/lib/cybersource";

type Body = {
  orderId?: string;
};

export async function POST(req: Request) {
  try {
    const { orderId } = (await req.json()) as Body;
    if (!orderId) {
      return new NextResponse("orderId requerido", { status: 400 });
    }

    const sb = createAdminClient();
    const { data: order, error } = await sb
      .from("orders")
      .select(
        "id, order_number, total_crc, customer_name, customer_email, customer_phone, shipping_address, shipping_canton, shipping_province"
      )
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return new NextResponse("Orden no encontrada", { status: 404 });
    }

    // Origen real desde donde se abrió el checkout (www o apex). Lo usamos como
    // targetOrigin para que coincida exacto y Cybersource no devuelva
    // "target origins are unused".
    const requestOrigin =
      req.headers.get("origin") ??
      (req.headers.get("host") ? `https://${req.headers.get("host")}` : undefined);

    const sessionJwt = await createSession({
      amountCRC: Number(order.total_crc),
      orderNumber: order.order_number,
      targetOrigin: requestOrigin ?? undefined,
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
        address: order.shipping_address ?? undefined,
        locality: order.shipping_canton ?? undefined,
        administrativeArea: order.shipping_province ?? undefined,
      },
    });

    const { clientLibrary, clientLibraryIntegrity } = getSdkAssets(sessionJwt);
    const debugPayload = decodeJwtPayload(sessionJwt);

    return NextResponse.json({
      sessionJwt,
      clientLibrary,
      clientLibraryIntegrity,
      debugPayload,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}
