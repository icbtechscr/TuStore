import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getProductsByIds } from "@/lib/products";
import {
  computeShippingCost,
  generateOrderNumber,
  MINIMUM_SUBTOTAL_FOR_SHIPPING,
  requiresShippingMinimum,
} from "@/lib/orders";
import { distanceKm, ORIGIN, getZone } from "@/lib/shipping";
import { stockOrderLimit } from "@/lib/stock";
import { notifyNewOrder } from "@/lib/email";

type Body = {
  items?: { id: string; qty: number }[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    idNumber?: string;
  };
  shipping?: {
    province?: string;
    canton?: string;
    address?: string;
    method?: string;
    notes?: string;
    zoneId?: string | null;
    size?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  paymentMethod?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const items = (body.items ?? []).filter(
      (i) => i.id && Number.isFinite(i.qty) && i.qty > 0
    );
    if (items.length === 0) {
      return new NextResponse("El carrito está vacío", { status: 400 });
    }
    const customer = body.customer ?? {};
    if (!customer.name || !customer.email || !customer.phone) {
      return new NextResponse("Faltan datos del cliente", { status: 400 });
    }
    const shipping = body.shipping ?? {};
    const shippingMethod = shipping.method ?? "encomienda";
    const paymentMethod = body.paymentMethod ?? "tarjeta";

    // Detalle del envío para el equipo de despacho.
    const shippingDetailParts = [shipping.notes ?? ""];
    if (shippingMethod === "encomienda") {
      const zone = getZone(shipping.zoneId);
      const size = shipping.size === "carro" ? "carro" : "moto";
      if (zone)
        shippingDetailParts.push(
          `Encomienda: ${zone.label} · ${zone.zone} (${size})`
        );
    }
    if (
      shippingMethod !== "recogida" &&
      typeof shipping.lat === "number" &&
      typeof shipping.lng === "number"
    ) {
      if (shippingMethod === "envio") {
        const km = Math.max(
          1,
          distanceKm(ORIGIN.lat, ORIGIN.lng, shipping.lat, shipping.lng)
        );
        shippingDetailParts.push(`Distancia: ~${km} km desde TUStore Barreal`);
      }
      shippingDetailParts.push(
        `Ubicación: https://maps.google.com/?q=${shipping.lat},${shipping.lng}`
      );
    }
    const shippingNotes = shippingDetailParts.filter(Boolean).join(" · ") || null;

    // Recalcular precios desde la base de datos (no confiar en el cliente)
    const products = await getProductsByIds(items.map((i) => i.id));
    const priceMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const p = priceMap.get(item.id);
      if (!p) continue;
      const qty = Math.min(99, Math.max(1, Math.floor(item.qty)));
      const stockLimit = stockOrderLimit(p.stockStatus, p.stockQty);
      if (stockLimit === 0) {
        return new NextResponse(
          `No hay unidades disponibles de ${p.name}.`,
          { status: 409 }
        );
      }
      if (stockLimit !== null && qty > stockLimit) {
        return new NextResponse(
          `Solo hay ${stockLimit} unidad${stockLimit === 1 ? "" : "es"} disponible${stockLimit === 1 ? "" : "s"} de ${p.name}.`,
          { status: 409 }
        );
      }
    }

    const lineItems = items
      .map((i) => {
        const p = priceMap.get(i.id);
        if (!p) return null;
        const unit = p.salePriceCRC ?? p.priceCRC;
        const qty = Math.min(99, Math.max(1, Math.floor(i.qty)));
        return {
          product_id: p.id,
          product_name: p.name,
          product_slug: p.slug,
          unit_price_crc: unit,
          qty,
          line_total_crc: unit * qty,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (lineItems.length === 0) {
      return new NextResponse("Ningún producto válido en el pedido", {
        status: 400,
      });
    }

    const subtotal = lineItems.reduce((a, i) => a + i.line_total_crc, 0);
    if (requiresShippingMinimum(shippingMethod) && subtotal < MINIMUM_SUBTOTAL_FOR_SHIPPING) {
      return new NextResponse("Para solicitar envío, el subtotal mínimo es de ₡10.000. También podés elegir recoger en sucursal para comprar cualquier monto.", {
        status: 400,
      });
    }
    const shippingCost = computeShippingCost({
      method: shippingMethod,
      lat: shipping.lat,
      lng: shipping.lng,
      zoneId: shipping.zoneId,
      size: shipping.size,
    });
    const total = subtotal + shippingCost;
    const orderNumber = generateOrderNumber();

    const sb = createAdminClient();
    const { data: order, error: orderErr } = await sb
      .from("orders")
      .insert({
        order_number: orderNumber,
        status: "pendiente",
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_id_number: customer.idNumber ?? null,
        shipping_province: shipping.province ?? null,
        shipping_canton: shipping.canton ?? null,
        shipping_address: shipping.address ?? null,
        shipping_method: shippingMethod,
        shipping_notes: shippingNotes,
        payment_method: paymentMethod,
        payment_status: "pendiente",
        subtotal_crc: subtotal,
        shipping_crc: shippingCost,
        total_crc: total,
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) {
      return new NextResponse(orderErr?.message ?? "Error al crear pedido", {
        status: 500,
      });
    }

    const { error: itemsErr } = await sb
      .from("order_items")
      .insert(lineItems.map((li) => ({ ...li, order_id: order.id })));

    if (itemsErr) {
      // limpiar la orden huérfana
      await sb.from("orders").delete().eq("id", order.id);
      return new NextResponse(itemsErr.message, { status: 500 });
    }

    // Aviso al admin. Con tarjeta el correo lo manda /api/payments/confirm
    // cuando el banco responde; para SINPE/transferencia no hay confirmacion
    // automatica, asi que avisamos aqui. Un correo por compra, sin duplicados.
    if (paymentMethod !== "tarjeta") {
      try {
        await notifyNewOrder({
          orderNumber,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          total,
          paymentMethod,
          shippingMethod,
          items: lineItems.map((li) => ({
            name: li.product_name,
            qty: li.qty,
            lineTotal: li.line_total_crc,
          })),
        });
      } catch {
        /* ignorar errores de correo */
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber,
      subtotal,
      shippingCost,
      total,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

