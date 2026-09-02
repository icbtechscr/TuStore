import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createTilopayHostedPayment } from "@/lib/tilopay";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { orderId } = (await req.json()) as { orderId?: string };
    if (!orderId) return new NextResponse("Falta orderId", { status: 400 });

    const sb = createAdminClient();
    const { data: order, error } = await sb
      .from("orders")
      .select("id, order_number, payment_status, customer_name, customer_email, customer_phone, customer_id_number, shipping_province, shipping_canton, shipping_address, total_crc")
      .eq("id", orderId)
      .single();
    if (error || !order) return new NextResponse("Orden no encontrada", { status: 404 });
    if (order.payment_status === "pagado") {
      return new NextResponse("Esta orden ya fue pagada", { status: 409 });
    }

    const [firstName, ...lastParts] = String(order.customer_name ?? "Cliente").trim().split(/\s+/);
    const lastName = lastParts.join(" ") || "TUStore";
    const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
    const payment = await createTilopayHostedPayment({
      redirect: `${site}/api/payments/tilopay/callback`,
      amount: Number(order.total_crc) || 0,
      currency: "CRC",
      orderNumber: order.order_number,
      firstName,
      lastName,
      email: order.customer_email,
      phone: order.customer_phone,
      address: order.shipping_address || "No indicado",
      city: order.shipping_canton || "Costa Rica",
      state: order.shipping_province || "CR-SJ",
      postalCode: "10101",
      country: "CR",
    });
    return NextResponse.json({ ok: true, url: payment.url, orderNumber: order.order_number });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo iniciar el pago";
    return new NextResponse(message, { status: 502 });
  }
}

