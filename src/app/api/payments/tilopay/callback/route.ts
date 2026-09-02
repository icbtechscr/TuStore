import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { notifyPaymentResult, sendCustomerReceipt } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const orderNumber = params.get("order") || params.get("orderNumber");
  const approved = params.get("code") === "1";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  if (!orderNumber) return NextResponse.redirect(`${site}/checkout/confirmacion?status=error`);

  try {
    const sb = createAdminClient();
    const { data: order } = await sb
      .from("orders")
      .select("id, order_number, payment_status, customer_name, customer_email, customer_phone, total_crc, payment_method, shipping_method")
      .eq("order_number", orderNumber)
      .single();
    if (!order) return NextResponse.redirect(`${site}/checkout/confirmacion?status=error`);

    const status = approved ? "pagado" : "rechazado";
    const reference = params.get("auth") || params.get("tilopay-transaction") || params.get("tpt");
    const safeResponse = Object.fromEntries(
      ["code", "description", "auth", "order", "tpt", "tilopay-transaction"].map((key) => [key, params.get(key)]).filter(([, value]) => value !== null)
    );
    if (order.payment_status !== "pagado") {
      await sb.from("orders").update({
        payment_status: status,
        status: approved ? "pagado" : "pendiente",
        payment_reference: reference,
        payment_response: safeResponse,
        updated_at: new Date().toISOString(),
      }).eq("id", order.id);
    }

    if (approved) {
      try {
        const { data: items } = await sb.from("order_items").select("product_name, qty, line_total_crc").eq("order_id", order.id);
        await sendCustomerReceipt({
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          total: Number(order.total_crc) || 0,
          paymentMethod: order.payment_method,
          shippingMethod: order.shipping_method,
          items: (items ?? []).map((i) => ({ name: i.product_name, qty: i.qty, lineTotal: Number(i.line_total_crc) || 0 })),
          authCode: params.get("auth") || undefined,
        });
      } catch {}
    }
    try {
      await notifyPaymentResult({ orderNumber: order.order_number, customerName: order.customer_name, customerEmail: order.customer_email, customerPhone: order.customer_phone, total: Number(order.total_crc) || 0, paymentMethod: order.payment_method, shippingMethod: order.shipping_method }, approved, params.get("description") || undefined);
    } catch {}
    return NextResponse.redirect(`${site}/checkout/confirmacion?status=${approved ? "approved" : "rejected"}&order=${encodeURIComponent(order.order_number)}`);
  } catch {
    return NextResponse.redirect(`${site}/checkout/confirmacion?status=error`);
  }
}

