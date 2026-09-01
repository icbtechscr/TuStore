"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Package,
  ShieldCheck,
  ChevronDown,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Truck,
  Trash2,
} from "lucide-react";
import {
  MANAGED_STATUSES,
  STATUS_LABEL,
  SHIPPING_LABEL,
  PAYMENT_LABEL,
  type Order,
  type OrderStatus,
} from "@/lib/orders";
import { formatCRC } from "@/lib/utils";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pendiente: "bg-amber-100 text-amber-700 border-amber-200",
  pagado: "bg-accent-50 text-accent-700 border-accent-200",
  preparando: "bg-sky-100 text-sky-700 border-sky-200",
  enviado: "bg-indigo-100 text-indigo-700 border-indigo-200",
  entregado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelado: "bg-red-100 text-red-700 border-red-200",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Bucket = "cobradas" | "sincobro";

const BUCKET_LABEL: Record<Bucket, string> = {
  cobradas: "Pagadas — listas para enviar",
  sincobro: "Sin cobro",
};

/** Cobrada = el dinero se rebajo de la tarjeta. Lo demas va a "Sin cobro". */
function bucketOf(o: Order): Bucket {
  return (o.paymentStatus || "").toLowerCase() === "pagado"
    ? "cobradas"
    : "sincobro";
}

function paymentStatusLabel(order: Order): string {
  if (order.paymentMethod === "tarjeta") {
    return order.paymentStatus.toLowerCase() === "pagado" ? "Aprobado" : "No aprobado";
  }
  return order.paymentStatus;
}

export function OrdersManager({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [bucket, setBucket] = useState<Bucket>("cobradas");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const router = useRouter();

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { cobradas: 0, sincobro: 0 };
    for (const o of orders) c[bucketOf(o)] += 1;
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (bucketOf(o) !== bucket) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [orders, bucket, query]);

  async function changeStatus(o: Order, status: OrderStatus) {
    setSavingId(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setOrders((prev) =>
        prev.map((x) => (x.id === o.id ? { ...x, status } : x))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  // Le pregunta a Cybersource si la tarjeta se cobro de verdad. Sirve para los
  // pedidos que quedaron "pendientes" porque el cliente cerro la pestana.
  async function verifyPayments(orderId?: string) {
    setVerifying(true);
    setError(null);
    setVerifyMsg(null);
    try {
      const res = await fetch("/api/admin/orders/verify-payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orderId ? { orderId } : {}),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as {
        revisados: number;
        cobrados: number;
        detalle: { pedido: string; resultado: string; estado?: string }[];
      };
      if (data.revisados === 0) {
        setVerifyMsg("No hay pedidos de tarjeta pendientes por revisar.");
      } else if (data.cobrados > 0) {
        setVerifyMsg(
          `${data.cobrados} de ${data.revisados} si estaban cobrados. Ya quedaron marcados como pagados y se les envio el comprobante al cliente.`
        );
      } else {
        const sinRegistro = data.detalle.filter(
          (d) => d.resultado === "sin registro"
        ).length;
        setVerifyMsg(
          `Se revisaron ${data.revisados}. Ninguno esta cobrado` +
            (sinRegistro
              ? `; de esos, ${sinRegistro} no tienen ninguna transaccion en Cybersource (lo mas probable: el cliente no llego a completar el formulario).`
              : ".")
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifying(false);
    }
  }

  async function deleteOrder(o: Order) {
    if (
      !window.confirm(
        `¿Borrar el pedido ${o.orderNumber}? Esta acción es permanente y no se puede deshacer.`
      )
    )
      return;
    setSavingId(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
      setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {verifyMsg && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
          {verifyMsg}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
        <p className="text-xs text-ink-600">
          Si un pedido de tarjeta quedo en <b>pendiente</b>, puede que la tarjeta si
          se haya cobrado y el navegador del cliente nunca alcanzo a avisar.
        </p>
        <button
          type="button"
          onClick={() => verifyPayments()}
          disabled={verifying}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand-600 bg-brand-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {verifying ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          Verificar cobros con el banco
        </button>
      </div>

      {/* Pestanas por resultado del pago */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["cobradas", "sincobro"] as Bucket[]).map((b) => {
          const active = bucket === b;
          const tone =
            b === "cobradas"
              ? "border-emerald-600 bg-emerald-600"
              : "border-red-600 bg-red-600";
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
                active
                  ? `${tone} text-white`
                  : "border-ink-200 text-ink-600 hover:bg-ink-100"
              }`}
            >
              {BUCKET_LABEL[b]} ({counts[b]})
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pedido, cliente…"
            className="w-60 rounded-xl border border-ink-200 bg-transparent py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-ink-400">
            <Package className="size-8" />
            <p className="text-sm">No hay pedidos para mostrar.</p>
          </div>
        )}
        <ul className="divide-y divide-ink-100">
          {visible.map((o) => {
            const open = expandedId === o.id;
            return (
              <li key={o.id}>
                <div
                  className="flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-ink-50"
                  onClick={() => setExpandedId(open ? null : o.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-ink-900">
                        {o.orderNumber}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          STATUS_STYLE[o.status]
                        }`}
                      >
                        {STATUS_LABEL[o.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-600">
                      {o.customerName} · {o.customerEmail}
                    </p>
                    <p className="text-xs text-ink-400">
                      {fmtDate(o.createdAt)} · <span className="font-mono">{o.id.slice(0, 8)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900">
                      {formatCRC(o.total)}
                    </p>
                    <p className="text-xs text-ink-400">
                      {o.items.reduce((a, i) => a + i.qty, 0)} art.
                    </p>
                  </div>
                  <ChevronDown
                    className={`size-5 shrink-0 text-ink-400 transition ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {open && (
                  <div className="border-t border-ink-100 bg-ink-50 px-5 py-4">
                    <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
                      {/* Artículos */}
                      <div>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                          Artículos
                        </h3>
                        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
                          {o.items.map((i) => (
                            <li
                              key={i.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-ink-700">
                                  {i.qty}× {i.productName}
                                </p>
                                <p className="text-[11px] text-ink-400">
                                  {formatCRC(i.unitPrice)} c/u
                                </p>
                              </div>
                              <span className="shrink-0 font-semibold text-ink-900">
                                {formatCRC(i.lineTotal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between text-ink-600">
                            <span>Subtotal</span>
                            <span>{formatCRC(o.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-ink-600">
                            <span>Envío</span>
                            <span>{formatCRC(o.shippingCost)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-ink-900">
                            <span>Total</span>
                            <span>{formatCRC(o.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cliente + envío */}
                      <div className="space-y-3 text-sm">
                        <div>
                          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-500">
                            Cliente
                          </h3>
                          <p className="font-semibold text-ink-900">
                            {o.customerName}
                          </p>
                          {o.customerIdNumber && (
                            <p className="text-ink-600">
                              Cédula: {o.customerIdNumber}
                            </p>
                          )}
                          <p className="flex items-center gap-1.5 text-ink-600">
                            <Mail className="size-3.5" /> {o.customerEmail}
                          </p>
                          <p className="flex items-center gap-1.5 text-ink-600">
                            <Phone className="size-3.5" /> {o.customerPhone}
                          </p>
                        </div>
                        <div>
                          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-500">
                            Entrega
                          </h3>
                          <p className="flex items-center gap-1.5 text-ink-600">
                            <Truck className="size-3.5" />
                            {SHIPPING_LABEL[o.shippingMethod] ??
                              o.shippingMethod}
                          </p>
                          {(o.shippingProvince || o.shippingAddress) && (
                            <p className="flex items-start gap-1.5 text-ink-600">
                              <MapPin className="mt-0.5 size-3.5 shrink-0" />
                              <span>
                                {[
                                  o.shippingAddress,
                                  o.shippingCanton,
                                  o.shippingProvince,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </p>
                          )}
                          {o.shippingNotes && (
                            <p className="text-ink-500">Nota: {o.shippingNotes}</p>
                          )}
                        </div>
                        <div>
                          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-500">
                            Pago
                          </h3>
                          <p className="flex items-center gap-1.5 text-ink-600">
                            <CreditCard className="size-3.5" />
                            {PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod} ·{" "}
                            <span className={`font-semibold ${o.paymentMethod === "tarjeta" && o.paymentStatus.toLowerCase() === "pagado" ? "text-emerald-700" : o.paymentMethod === "tarjeta" ? "text-red-700" : ""}`}>
                              {paymentStatusLabel(o)}
                            </span>
                          </p>
                          <PaymentDetails order={o} />
                        </div>
                        <div>
                          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-500">
                            Estado del pedido
                          </h3>
                          <div className="flex items-center gap-2">
                            <select
                              value={o.status}
                              onChange={(e) =>
                                changeStatus(o, e.target.value as OrderStatus)
                              }
                              disabled={savingId === o.id}
                              className="rounded-xl border border-ink-200 bg-transparent px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 disabled:opacity-60"
                            >
                              {MANAGED_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            {savingId === o.id && (
                              <Loader2 className="size-4 animate-spin text-brand-600" />
                            )}
                          </div>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => deleteOrder(o)}
                            disabled={savingId === o.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                          >
                            <Trash2 className="size-3.5" /> Borrar pedido
                          </button>
                          <button
                            type="button"
                            onClick={() => verifyPayments(o.id)}
                            disabled={verifying}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-100 disabled:opacity-60"
                          >
                            {verifying ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="size-3.5" />
                            )}
                            Verificar cobro
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function PaymentDetails({ order }: { order: Order }) {
  const r = order.paymentResponse as Record<string, unknown> | null;
  const pi = (r?.paymentInformation as Record<string, unknown> | undefined) ?? undefined;
  const card = (pi?.card as Record<string, unknown> | undefined) ?? undefined;
  const tokenizedCard = (pi?.tokenizedCard as Record<string, unknown> | undefined) ?? undefined;
  const proc = (r?.processorInformation as Record<string, unknown> | undefined) ?? undefined;
  const auth =
    (proc?.approvalCode as string | undefined) ??
    (proc?.transactionId as string | undefined);

  const brand =
    (card?.type as string | undefined) ??
    (tokenizedCard?.type as string | undefined);
  const suffix =
    (card?.suffix as string | undefined) ??
    (tokenizedCard?.suffix as string | undefined);
  const reasonCode = r?.reasonCode as string | undefined;
  const message = r?.message as string | undefined;
  const cybsStatus = r?.status as string | undefined;

  const CARD_BRAND: Record<string, string> = {
    "001": "Visa",
    "002": "Mastercard",
    "003": "Amex",
    "004": "Discover",
  };
  const brandLabel = brand ? CARD_BRAND[brand] ?? brand : null;

  const hasAny =
    order.paymentReference || brandLabel || suffix || auth || reasonCode || message || cybsStatus;
  if (!hasAny) return null;

  return (
    <div className="mt-2 space-y-0.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600">
      {brandLabel && (
        <p>
          <span className="text-ink-400">Tarjeta:</span>{" "}
          <span className="font-semibold text-ink-900">
            {brandLabel}
            {suffix ? ` · •••• ${suffix}` : ""}
          </span>
        </p>
      )}
      {cybsStatus && (
        <p>
          <span className="text-ink-400">Estado Cybersource:</span>{" "}
          <span className="font-semibold text-ink-900">{cybsStatus}</span>
        </p>
      )}
      {auth && (
        <p>
          <span className="text-ink-400">Autorización:</span>{" "}
          <span className="font-mono text-ink-900">{auth}</span>
        </p>
      )}
      {order.paymentReference && (
        <p>
          <span className="text-ink-400">Payment ID:</span>{" "}
          <span className="font-mono text-[11px] text-ink-900">{order.paymentReference}</span>
        </p>
      )}
      {reasonCode && (
        <p>
          <span className="text-ink-400">Reason:</span>{" "}
          <span className="text-ink-900">
            {reasonCode}
            {message ? ` — ${message}` : ""}
          </span>
        </p>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-ink-400 hover:text-ink-600">
          Ver respuesta completa
        </summary>
        <pre className="mt-1 max-h-60 overflow-auto rounded bg-ink-50 p-2 text-[10px] leading-tight text-ink-700">
          {JSON.stringify(order.paymentResponse, null, 2)}
        </pre>
      </details>
    </div>
  );
}
