"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Trash2, Minus, Plus, ArrowRight, ShoppingBag, ChevronRight } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { useCart } from "@/lib/cart";
import {
  STOCK_LABELS,
  isPurchasableProduct,
  stockOrderLimit,
} from "@/lib/stock";
import { formatCRC } from "@/lib/utils";

export default function CartPage() {
  const { items, subtotal, count, setQty, remove } = useCart();
  const total = subtotal;
  const invalidItem = items.find(
    (item) =>
      !isPurchasableProduct(item.stockStatus, item.stockQty, item.unitPrice)
  );
  const canCheckout = items.length > 0 && !invalidItem;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 md:pb-24">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs font-medium text-ink-500">
          <Link href="/" className="hover:text-brand-600">
            Inicio
          </Link>
          <ChevronRight className="size-3.5 text-ink-300" />
          <span className="text-ink-900">Carrito</span>
        </nav>

        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-ink-900 md:text-5xl">
              Tu carrito
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              {count === 0
                ? "Aún no tenés productos"
                : `${count} ${count === 1 ? "producto" : "productos"} listo${count === 1 ? "" : "s"} para revisar`}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-3">
              {items.map((it, i) => {
                const limit = stockOrderLimit(it.stockStatus, it.stockQty);
                const reachedLimit = limit !== null && it.qty >= limit;

                return (
                  <motion.article
                    key={it.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="flex flex-col gap-4 rounded-3xl border border-ink-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
                  >
                    <Link
                      href={`/productos/${it.slug}`}
                      className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white sm:size-28 sm:shrink-0"
                    >
                      <ProductImage
                        src={it.image}
                        alt={it.name}
                        sizes="(max-width: 640px) 100vw, 112px"
                        className="p-3"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      {it.brand && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-800">
                          {it.brand}
                        </span>
                      )}
                      <Link
                        href={`/productos/${it.slug}`}
                        className="line-clamp-2 text-sm font-semibold text-ink-900 hover:text-brand-600"
                      >
                        {it.name}
                      </Link>
                      <div className="mt-2 text-xs text-ink-500">
                        Precio unitario:{" "}
                        <span className="font-bold text-ink-900">
                          {formatCRC(it.unitPrice)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-ink-400">
                        {it.stockStatus === "in_stock" && limit !== null
                          ? `Maximo disponible: ${limit}`
                          : STOCK_LABELS[it.stockStatus]}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <div className="inline-flex items-center rounded-full border border-ink-200 bg-ink-50 p-1">
                        <button
                          aria-label="Restar"
                          onClick={() => setQty(it.id, it.qty - 1)}
                          className="inline-flex size-8 items-center justify-center rounded-full text-ink-700 hover:bg-ink-200"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold tabular-nums text-ink-900">
                          {it.qty}
                        </span>
                        <button
                          aria-label="Sumar"
                          onClick={() => setQty(it.id, it.qty + 1)}
                          disabled={reachedLimit}
                          className="inline-flex size-8 items-center justify-center rounded-full text-ink-700 hover:bg-ink-200 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black tabular-nums text-ink-900">
                          {formatCRC(it.qty * it.unitPrice)}
                        </div>
                        <button
                          onClick={() => remove(it.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-400 hover:text-danger"
                        >
                          <Trash2 className="size-3" />
                          Quitar
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-ink-900">Resumen del pedido</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between border-b border-ink-200 pb-3">
                    <dt className="text-ink-500">Subtotal</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">{formatCRC(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between border-b border-ink-200 pb-3">
                    <dt className="text-ink-500">Envío</dt>
                    <dd className="font-semibold text-accent-800">A calcular</dd>
                  </div>
                  <div className="flex items-end justify-between pt-2">
                    <div>
                      <dt className="text-sm font-bold text-ink-900">Total</dt>
                      <span className="text-[11px] text-ink-400">IVA incluido (13%)</span>
                    </div>
                    <dd className="text-3xl font-black tabular-nums text-ink-900">
                      {formatCRC(total)}
                    </dd>
                  </div>
                </dl>

                {canCheckout ? (
                  <Link
                    href="/checkout"
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3.5 text-sm font-bold text-ink-900 shadow-lg shadow-accent-500/30 transition-all hover:bg-accent-400 active:scale-95"
                  >
                    Proceder al pago
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-6 inline-flex w-full cursor-not-allowed flex-col items-center justify-center rounded-full bg-ink-200 px-6 py-3 text-ink-600"
                  >
                    <span className="text-sm font-bold">
                      Este pedido no se puede procesar
                    </span>
                    <span className="text-[11px] font-medium">
                      {invalidItem?.unitPrice === 0
                        ? "Hay un producto cuyo precio requiere consulta"
                        : "Hay un producto agotado o en contrapedido"}
                    </span>
                  </button>
                )}
                <Link
                  href="/productos"
                  className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-ink-200 bg-white px-6 py-3 text-xs font-semibold text-ink-600 transition hover:bg-ink-50"
                >
                  Seguir comprando
                </Link>

                <p className="mt-4 text-center text-[11px] text-ink-400">
                  Pago seguro · SINPE Móvil · Tarjeta · Cuotas
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent-100 ring-1 ring-accent-200">
        <ShoppingBag className="size-7 text-accent-700" />
      </div>
      <h2 className="mt-4 text-xl font-black text-ink-900">Carrito vacío</h2>
      <p className="mt-2 text-sm text-ink-500">
        Explorá el catálogo y agregá productos que te interesen.
      </p>
      <Link
        href="/productos"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900 shadow-lg shadow-accent-500/30 transition hover:bg-accent-400"
      >
        Ver catálogo
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
