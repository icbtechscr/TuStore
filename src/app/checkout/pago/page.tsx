"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatCRC } from "@/lib/utils";
import { CheckoutStepper } from "@/components/CheckoutStepper";
import {
  getZone,
  zoneRate,
  distanceShippingCost,
  type PackageSize,
} from "@/lib/shipping";

const SHIPPING_KEY = "tustore-checkout-v1";

type Shipping = {
  method: "recogida" | "envio" | "encomienda";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  province: string;
  canton: string;
  postalCode: string;
  address: string;
  reference: string;
  lat: number | null;
  lng: number | null;
  zoneId: string;
  size: PackageSize;
};

const SHIPPING_LABELS: Record<Shipping["method"], string> = {
  recogida: "Recogida en TUStore Barreal",
  envio: "Envío a domicilio",
  encomienda: "Encomienda",
};

export default function PagoPage() {
  const { items, subtotal, count } = useCart();
  const [shipping, setShipping] = useState<Shipping | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SHIPPING_KEY);
      if (raw) setShipping(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-32">
        <span className="size-8 animate-spin rounded-full border-2 border-ink-300 border-r-transparent" />
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-ink-900">Tu carrito está vacío</h1>
        <Link
          href="/productos"
          className="mt-6 inline-flex rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  if (!shipping) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-ink-900">Falta la información de entrega</h1>
        <p className="mt-3 text-sm text-ink-500">
          Completá tus datos antes de coordinar el pago.
        </p>
        <Link
          href="/checkout"
          className="mt-6 inline-flex rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900"
        >
          Completar entrega
        </Link>
      </div>
    );
  }

  const zone = getZone(shipping.zoneId);
  const shippingCost =
    shipping.method === "recogida"
      ? 0
      : shipping.method === "encomienda"
        ? zone
          ? zoneRate(zone, shipping.size)
          : 0
        : distanceShippingCost(shipping.lat, shipping.lng);
  const total = subtotal + shippingCost;
  const customerName = `${shipping.firstName} ${shipping.lastName}`.trim();
  const itemLines = items.map(
    (item) =>
      `• ${item.qty} × ${item.name} — ${formatCRC(item.unitPrice * item.qty)}`
  );
  const deliveryLine =
    shipping.method === "recogida"
      ? SHIPPING_LABELS.recogida
      : `${SHIPPING_LABELS[shipping.method]}: ${shipping.address}, ${shipping.canton}, ${shipping.province}`;
  const message = [
    "Hola TUStore Costa Rica. Quiero coordinar este pedido:",
    "",
    ...itemLines,
    "",
    `Cliente: ${customerName}`,
    `Entrega: ${deliveryLine}`,
    shipping.reference ? `Referencia: ${shipping.reference}` : "",
    `Subtotal: ${formatCRC(subtotal)}`,
    `Envío estimado: ${shippingCost ? formatCRC(shippingCost) : "Por confirmar / gratis"}`,
    `Total estimado: ${formatCRC(total)}`,
    "",
    "Quiero confirmar disponibilidad y recibir las opciones de pago.",
  ]
    .filter(Boolean)
    .join("\n");
  const whatsappUrl = `https://wa.me/50640025649?text=${encodeURIComponent(message)}`;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 md:pb-24">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">Inicio</Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <Link href="/carrito" className="hover:text-brand-600">Carrito</Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <Link href="/checkout" className="hover:text-brand-600">Entrega</Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">Confirmación</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-4xl">
            Confirmá tu pedido con un asesor
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
            TUStore confirma inventario, entrega y el método de pago más conveniente
            directamente por WhatsApp.
          </p>
        </div>

        <CheckoutStepper current={2} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-700 ring-1 ring-accent-200">
              <MessageCircle className="size-6" />
            </div>
            <h2 className="mt-5 text-2xl font-black text-ink-900">
              Atención personal y pago seguro
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
              Al continuar se abrirá WhatsApp con el resumen preparado. Un asesor te
              indicará cómo pagar por SINPE Móvil, transferencia, efectivo o link de
              pago para tarjeta.
            </p>
            <ul className="mt-6 grid gap-3 text-sm text-ink-600 sm:grid-cols-2">
              <li className="flex items-center gap-2 rounded-xl bg-ink-50 p-3">
                <ShieldCheck className="size-4 text-brand-600" />
                Datos de pago confirmados por un asesor
              </li>
              <li className="flex items-center gap-2 rounded-xl bg-ink-50 p-3">
                <Smartphone className="size-4 text-brand-600" />
                Atención al +506 4002 5649
              </li>
            </ul>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-accent-600/20 transition hover:bg-accent-700 sm:w-auto"
            >
              <MessageCircle className="size-5" />
              Continuar por WhatsApp
            </a>
          </section>

          <aside className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-lg font-black text-ink-900">Resumen</h2>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 text-sm">
                  <span className="line-clamp-2 text-ink-600">
                    {item.qty} × {item.name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                    {formatCRC(item.unitPrice * item.qty)}
                  </span>
                </div>
              ))}
            </div>
            <dl className="mt-5 space-y-2 border-t border-ink-200 pt-4 text-sm">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd>{formatCRC(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-600">
                <dt>Envío estimado</dt>
                <dd>{shippingCost ? formatCRC(shippingCost) : "Por confirmar"}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-3 text-lg font-black text-ink-900">
                <dt>Total estimado</dt>
                <dd>{formatCRC(total)}</dd>
              </div>
            </dl>
            <Link
              href="/checkout"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 hover:text-brand-600"
            >
              <ArrowLeft className="size-4" />
              Cambiar entrega
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
