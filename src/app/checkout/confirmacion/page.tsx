"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Download,
  Home,
  Package,
  Truck,
  Mail,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatCRC } from "@/lib/utils";
import { CheckoutStepper } from "@/components/CheckoutStepper";
import { ProductImage } from "@/components/ProductImage";

type Order = {
  orderId: string;
  createdAt: string;
  items: {
    id: string;
    name: string;
    image: string | null;
    qty: number;
    unitPrice: number;
  }[];
  subtotal: number;
  shippingCost: number;
  total: number;
  shipping: {
    fullName: string;
    email: string;
    phone: string;
    province: string;
    canton: string;
    address: string;
    method: string;
  };
  paymentMethod: string;
};

const PAYMENT_LABEL: Record<string, string> = {
  tarjeta: "Tarjeta",
  sinpe: "SINPE Móvil",
  transferencia: "Transferencia bancaria",
};

const SHIPPING_LABEL: Record<string, string> = {
  express: "Express (24h)",
  estandar: "Estándar (2-4 días)",
  recogida: "Recogida en sucursal",
  encomienda: "Envío a domicilio",
};

export default function ConfirmacionPage() {
  const { clear } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tustore-last-order");
      if (raw) setOrder(JSON.parse(raw));
      setPaymentStatus(new URLSearchParams(window.location.search).get("status"));
    } catch {}
    clear();
  }, [clear]);

  if (!order) {
    return (
      <div className="bg-white">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-3xl font-black text-ink-900">No encontramos tu pedido</h1>
          <p className="mt-2 text-ink-500">
            Si acabás de pagar, recargá la página. De lo contrario, volvé al inicio.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900"
          >
            <Home className="size-4" />
            Inicio
          </Link>
        </div>
      </div>
    );
  }

  const paymentFailed = paymentStatus === "rejected" || paymentStatus === "error";

  const eta = new Date(order.createdAt);
  if (order.shipping.method === "recogida") eta.setDate(eta.getDate() + 1);
  else eta.setDate(eta.getDate() + 3);

  function copyId() {
    if (!order) return;
    navigator.clipboard?.writeText(order.orderId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 md:pb-24">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">Inicio</Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">Confirmación</span>
        </nav>

        <CheckoutStepper current={3} />

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="mt-10 flex flex-col items-center text-center"
        >
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 14 }}
            className="relative"
          >
            <div className="absolute inset-0 -m-4 animate-ping rounded-full bg-emerald-400/30" />
            <div className={`relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br shadow-xl ring-4 ${paymentFailed ? "from-red-400 to-red-600 shadow-red-500/40 ring-red-100" : "from-emerald-400 to-emerald-600 shadow-emerald-500/40 ring-emerald-100"}`}>
              <CheckCircle2 className="size-10 text-white" strokeWidth={2.5} />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 text-4xl font-black tracking-tight text-ink-900 md:text-5xl"
          >
            {paymentFailed ? "Pago no completado" : "¡Gracias por tu compra!"}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-3 max-w-xl text-base text-ink-500"
          >
            {paymentFailed
              ? "No se pudo aprobar el pago. Podés intentar nuevamente o contactarnos por WhatsApp."
              : "Recibimos tu pedido y te enviamos un correo de confirmación a "}
            {!paymentFailed && (
            <span className="font-semibold text-accent-700">
              {order.shipping.email}
            </span>
            )}
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={copyId}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-bold text-ink-900 shadow-sm transition-colors hover:bg-ink-50"
          >
            <span className="text-ink-500">Pedido:</span>
            <span className="font-mono text-accent-700">{order.orderId}</span>
            <span className="ml-1 inline-flex items-center gap-1 text-xs text-ink-500">
              {copied ? "Copiado!" : <Copy className="size-3.5" />}
            </span>
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-10 grid gap-6 md:grid-cols-3"
        >
          <InfoCard Icon={Truck} title="Entrega estimada">
            <div className="text-lg font-black text-ink-900">
              {eta.toLocaleDateString("es-CR", {
                weekday: "short",
                day: "numeric",
                month: "long",
              })}
            </div>
            <div className="mt-1 text-xs text-ink-500">
              {SHIPPING_LABEL[order.shipping.method]}
            </div>
          </InfoCard>
          <InfoCard Icon={Package} title="Estado">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              En preparación
            </div>
            <div className="mt-2 text-xs text-ink-500">
              Te avisamos al despachar.
            </div>
          </InfoCard>
          <InfoCard Icon={Mail} title="Método de pago">
            <div className="text-lg font-black text-ink-900">
              {PAYMENT_LABEL[order.paymentMethod]}
            </div>
            <div className="mt-1 text-xs text-ink-500">
              {order.paymentMethod === "tarjeta"
                ? "Cobro aprobado"
                : "Pendiente de verificación"}
            </div>
          </InfoCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]"
        >
          <section className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-900">
              <Package className="size-4 text-accent-600" />
              Productos ({order.items.reduce((a, i) => a + i.qty, 0)})
            </h2>
            <ul className="space-y-3">
              {order.items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-4 border-b border-ink-200 pb-3 last:border-0"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-ink-200 bg-white">
                    <ProductImage
                      src={it.image}
                      alt={it.name}
                      sizes="56px"
                      className="p-1"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold text-ink-900">
                      {it.name}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-500">
                      x{it.qty} · {formatCRC(it.unitPrice)}
                    </div>
                  </div>
                  <div className="text-sm font-black tabular-nums text-ink-900">
                    {formatCRC(it.qty * it.unitPrice)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-4 border-t border-ink-200 pt-5 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  Dirección de envío
                </h3>
                <div className="mt-2 text-sm">
                  <div className="font-bold text-ink-900">
                    {order.shipping.fullName}
                  </div>
                  <div className="mt-0.5 text-ink-600">
                    {order.shipping.address}
                  </div>
                  <div className="text-ink-600">
                    {order.shipping.canton}, {order.shipping.province}
                  </div>
                  <div className="mt-1 text-ink-500">
                    {order.shipping.phone}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  Próximos pasos
                </h3>
                <ol className="mt-2 space-y-2 text-sm text-ink-600">
                  <li className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                    Validamos el pago
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                    Preparamos tu paquete
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent-600" />
                    Te enviamos número de rastreo
                  </li>
                </ol>
              </div>
            </div>
          </section>

          <aside>
            <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-900">
                Total pagado
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Subtotal" value={formatCRC(order.subtotal)} />
                <Row
                  label="Envío"
                  value={
                    order.shippingCost === 0
                      ? "Gratis"
                      : formatCRC(order.shippingCost)
                  }
                  highlight={order.shippingCost === 0}
                />
                <div className="mt-2 flex items-end justify-between border-t border-ink-200 pt-3">
                  <div>
                    <dt className="text-sm font-bold text-ink-900">Total</dt>
                    <span className="text-[11px] text-ink-400">IVA incluido (13%)</span>
                  </div>
                  <dd className="text-3xl font-black tabular-nums text-accent-700">
                    {formatCRC(order.total)}
                  </dd>
                </div>
              </dl>

              <button
                onClick={() => window.print()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-bold text-ink-700 transition-colors hover:bg-ink-50"
              >
                <Download className="size-4" />
                Descargar comprobante
              </button>
              <Link
                href="/productos"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900 shadow-lg shadow-accent-500/30 transition hover:bg-accent-400"
              >
                Seguir comprando
              </Link>
              <Link
                href="/"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 text-xs font-semibold text-ink-500 hover:text-brand-600"
              >
                <Home className="size-3.5" />
                Volver al inicio
              </Link>
            </div>
          </aside>
        </motion.div>
      </div>
    </div>
  );
}

function InfoCard({
  Icon,
  title,
  children,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500">
        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-accent-100 text-accent-700 ring-1 ring-accent-200">
          <Icon className="size-3.5" />
        </span>
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd
        className={`font-semibold tabular-nums ${
          highlight ? "text-accent-700" : "text-ink-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
